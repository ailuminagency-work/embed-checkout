// Daily reconciliation: finds Stripe PaymentIntents with no matching booking record.
// If orphans found, sends an alert to the admin email.

import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (_req: Request) => {
  const { data: settings } = await supabase
    .from("app_settings")
    .select("key, value")
    .in("key", ["stripe_mode", "contact_email"]);

  const config = Object.fromEntries(
    (settings ?? []).map((s: { key: string; value: string }) => [s.key, s.value]),
  );

  const stripeMode = config.stripe_mode ?? "test";
  const stripeKey = Deno.env.get(
    stripeMode === "live" ? "STRIPE_SECRET_KEY_LIVE" : "STRIPE_SECRET_KEY_TEST",
  ) ?? Deno.env.get("STRIPE_SECRET_KEY") ?? "";

  if (!stripeKey) return new Response("No Stripe key", { status: 200 });

  const stripe = new Stripe(stripeKey, {
    apiVersion: "2023-10-16",
    httpClient: Stripe.createFetchHttpClient(),
  });

  const oneDayAgo = Math.floor((Date.now() - 86_400_000) / 1000);

  const paymentIntents = await stripe.paymentIntents.list({
    created: { gte: oneDayAgo },
    limit: 100,
  });

  const orphans: { id: string; amount: number; currency: string }[] = [];

  for (const pi of paymentIntents.data) {
    if (pi.status !== "succeeded") continue;

    const { data: booking } = await supabase
      .from("bookings")
      .select("id")
      .or(`payment_intent_id.eq.${pi.id},payment_id.eq.${pi.id}`)
      .maybeSingle();

    if (!booking) {
      orphans.push({ id: pi.id, amount: pi.amount / 100, currency: pi.currency });
    }
  }

  if (orphans.length > 0 && config.contact_email) {
    await supabase.functions.invoke("send-admin-alert", {
      body: {
        subject: `⚠️ ${orphans.length} Orphaned Payment(s) Detected`,
        message: `The following payments succeeded in Stripe but have no booking record:\n\n${orphans
          .map((o) => `- ${o.id}: $${o.amount} ${o.currency.toUpperCase()}`)
          .join("\n")}\n\nPlease investigate in your Stripe dashboard.`,
        admin_email: config.contact_email,
      },
    });
  }

  return new Response(
    JSON.stringify({ ok: true, orphans_found: orphans.length, orphans }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});
