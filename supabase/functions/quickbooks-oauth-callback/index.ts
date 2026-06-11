// Intuit redirects the admin's browser here after authorization.
// verify_jwt = false (set in config.toml) — authenticity is enforced by the
// single-use CSRF state token. Exchanges the code for tokens, stores them in
// integration_secrets (admin-only RLS), and flags the add-on as connected.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { saveQBOTokens } from "../_shared/quickbooks.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function htmlPage(title: string, message: string, ok: boolean): Response {
  return new Response(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title></head>
<body style="font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:90vh;background:#f9fafb;">
<div style="background:#fff;border-radius:12px;padding:40px;max-width:420px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,.1);">
<div style="font-size:40px;">${ok ? "✅" : "❌"}</div>
<h1 style="font-size:20px;color:#111827;">${title}</h1>
<p style="color:#6b7280;font-size:14px;line-height:1.6;">${message}</p>
</div></body></html>`,
    { status: ok ? 200 : 400, headers: { "Content-Type": "text/html" } },
  );
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const realmId = url.searchParams.get("realmId");
  const state = url.searchParams.get("state");

  if (!code || !realmId || !state) {
    return htmlPage("Connection failed", "Missing code, realmId, or state in the callback.", false);
  }

  // CSRF check: state must match the one we generated, and is single-use.
  const { data: storedState } = await supabase
    .from("integration_secrets")
    .select("value")
    .eq("key", "quickbooks_oauth_state")
    .maybeSingle();

  if (!storedState?.value || storedState.value !== state) {
    return htmlPage("Connection failed", "Invalid or expired authorization state. Please try connecting again from the admin panel.", false);
  }
  await supabase.from("integration_secrets")
    .update({ value: "", updated_at: new Date().toISOString() })
    .eq("key", "quickbooks_oauth_state");

  const { data: secrets } = await supabase
    .from("integration_secrets")
    .select("key, value")
    .in("key", ["quickbooks_client_id", "quickbooks_client_secret"]);
  const cfg = Object.fromEntries((secrets ?? []).map((r: { key: string; value: string | null }) => [r.key, r.value ?? ""]));

  const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/quickbooks-oauth-callback`;
  const tokenRes = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${btoa(`${cfg.quickbooks_client_id}:${cfg.quickbooks_client_secret}`)}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    console.error("[qbo-oauth-callback] Token exchange failed:", err);
    return htmlPage("Connection failed", "Token exchange with Intuit failed. Check that your Client ID, Client Secret, and Redirect URI match your Intuit app settings.", false);
  }

  const tokens = await tokenRes.json();
  await saveQBOTokens(tokens);

  // Non-sensitive flags → app_settings (drives the add-on Connected status)
  await supabase.from("app_settings").upsert([
    { key: "quickbooks_realm_id",  value: realmId },
    { key: "quickbooks_connected", value: "true" },
  ], { onConflict: "key" });

  await supabase.from("booking_events").insert({
    event_type: "quickbooks.connected",
    payload: { realm_id: realmId },
    source: "admin",
  });

  return htmlPage(
    "QuickBooks connected",
    "Sales Receipts will now be created automatically for every confirmed booking. You can close this tab and return to the admin panel.",
    true,
  );
});
