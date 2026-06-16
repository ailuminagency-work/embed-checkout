// One-click Stripe setup, called from the admin Setup wizard.
// Validates the secret key, auto-registers the payment_intent.succeeded webhook,
// pushes secrets to the Edge Function env (Management API), and stores only
// non-sensitive hints/flags in app_settings. Admin-only.

import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json, error as jsonError } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_KEY);

// Verify the caller is a signed-in admin (functions run with verify_jwt, but any
// authenticated user could otherwise reach this — gate on admin_users).
async function requireAdmin(req: Request): Promise<boolean> {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) return false;
  const asUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data: { user } } = await asUser.auth.getUser();
  if (!user) return false;
  // user_roles is the authoritative admin source used by the app's own auth.
  const { data } = await admin.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
  return !!data;
}

async function pushSecrets(secrets: { name: string; value: string }[]): Promise<string | null> {
  const accessToken = Deno.env.get("SUPABASE_ACCESS_TOKEN");
  const projectRef = SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
  if (!accessToken || !projectRef) {
    return "SUPABASE_ACCESS_TOKEN not set — add it to Edge Function secrets to enable automatic key storage.";
  }
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/secrets`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(secrets),
  });
  if (!res.ok) return `Failed to store secrets via Management API (${res.status}): ${await res.text()}`;
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (!(await requireAdmin(req))) return jsonError("Admin access required", 403);

  try {
    const { secret_key, publishable_key } = await req.json();

    if (!secret_key?.startsWith("sk_")) return jsonError("Invalid Stripe secret key (must start with sk_)", 400);
    if (!publishable_key?.startsWith("pk_")) return jsonError("Invalid Stripe publishable key (must start with pk_)", 400);

    const mode = secret_key.startsWith("sk_live") ? "live" : "test";
    const stripe = new Stripe(secret_key, {
      apiVersion: "2023-10-16",
      httpClient: Stripe.createFetchHttpClient(),
    });

    // 1. Validate the key
    try {
      await stripe.accounts.retrieve();
    } catch {
      return jsonError("Stripe rejected this key. Double-check you copied the full secret key.", 400);
    }

    // 2. Register (or refresh) the webhook for our stripe-webhook endpoint
    const webhookUrl = `${SUPABASE_URL}/functions/v1/stripe-webhook`;
    const existing = await stripe.webhookEndpoints.list({ limit: 100 });
    for (const e of existing.data) {
      if (e.url === webhookUrl) await stripe.webhookEndpoints.del(e.id); // delete to mint a fresh signing secret
    }
    const webhook = await stripe.webhookEndpoints.create({
      url: webhookUrl,
      enabled_events: ["payment_intent.succeeded", "payment_intent.payment_failed", "charge.refunded"],
      description: "Booking widget — confirmation, failure, refund handling",
    });
    const webhookSecret = webhook.secret!;

    // 3. Push secrets to the Edge Function env (mode-specific + generic fallbacks)
    const secretError = await pushSecrets([
      { name: "STRIPE_SECRET_KEY", value: secret_key },
      { name: mode === "live" ? "STRIPE_SECRET_KEY_LIVE" : "STRIPE_SECRET_KEY_TEST", value: secret_key },
      { name: "STRIPE_WEBHOOK_SECRET", value: webhookSecret },
      { name: mode === "live" ? "STRIPE_WEBHOOK_SECRET_LIVE" : "STRIPE_WEBHOOK_SECRET_TEST", value: webhookSecret },
    ]);

    // 4. Store only non-sensitive hints + the publishable key in app_settings
    await admin.from("app_settings").upsert([
      { key: "stripe_mode", value: mode },
      { key: "stripe_publishable_key", value: publishable_key },
      { key: mode === "live" ? "stripe_publishable_key_live" : "stripe_publishable_key_test", value: publishable_key },
      { key: "stripe_secret_key_hint", value: `…${secret_key.slice(-4)}` },
      { key: "setup_step_stripe", value: secretError ? "false" : "true" },
    ], { onConflict: "key" });

    return json({
      success: !secretError,
      mode,
      webhook_url: webhookUrl,
      webhook_id: webhook.id,
      warning: secretError,
    });
  } catch (err) {
    console.error("[setup-stripe]", err);
    return jsonError(err instanceof Error ? err.message : "Setup failed", 500);
  }
});
