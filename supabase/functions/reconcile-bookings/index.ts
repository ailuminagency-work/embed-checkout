// Reconciliation safety net — called by pg_cron every 5 minutes.
// Finds pending bookings older than 10 minutes and asks Stripe what actually
// happened. If the payment succeeded but no booking exists (webhook missed,
// DB insert failed, webhook not registered yet), it auto-confirms the booking
// and sends the confirmation email. Guaranteed recovery within ~15 minutes.

import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function getStripe(mode: string): Stripe | null {
  const key =
    Deno.env.get(mode === "live" ? "STRIPE_SECRET_KEY_LIVE" : "STRIPE_SECRET_KEY_TEST") ??
    Deno.env.get("STRIPE_SECRET_KEY") ?? "";
  if (!key) return null;
  return new Stripe(key, {
    apiVersion: "2023-10-16",
    httpClient: Stripe.createFetchHttpClient(),
  });
}

async function logEvent(bookingId: string | null, eventType: string, payload: Record<string, unknown>) {
  try {
    await supabase.from("booking_events").insert({
      booking_id: bookingId, event_type: eventType, payload, source: "reconciliation",
    });
  } catch { /* never crash on logging */ }
}

Deno.serve(async (req: Request) => {
  // Internal only — pg_cron calls with the service role key.
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.includes(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)) {
    return new Response("Forbidden", { status: 403 });
  }

  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data: stalePending } = await supabase
    .from("pending_bookings")
    .select("*")
    .eq("status", "pending")
    .not("payment_intent_id", "is", null)
    .lt("created_at", tenMinAgo)
    .gt("expires_at", new Date().toISOString())
    .limit(25);

  if (!stalePending?.length) {
    return new Response(JSON.stringify({ checked: 0 }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  }

  let confirmed = 0, emailed = 0, abandoned = 0, skipped = 0;

  for (const pending of stalePending) {
    const stripe = getStripe(pending.stripe_mode ?? "test");
    if (!stripe) { skipped++; continue; }

    let pi: Stripe.PaymentIntent;
    try {
      pi = await stripe.paymentIntents.retrieve(pending.payment_intent_id);
    } catch {
      skipped++;
      continue;
    }

    if (pi.status === "succeeded") {
      // Duplicate-safe: the booking may already exist (browser or webhook path).
      const { data: existingBooking } = await supabase
        .from("bookings")
        .select("id")
        .or(`payment_intent_id.eq.${pi.id},payment_id.eq.${pi.id}`)
        .maybeSingle();

      let bookingId = existingBooking?.id ?? null;

      if (!bookingId) {
        const bd = pending.booking_data as Record<string, unknown>;
        const { data: inserted, error } = await supabase.from("bookings").insert({
          reference: pi.id,
          payment_id: pi.id,
          payment_intent_id: pi.id,
          stripe_mode: pending.stripe_mode ?? "test",
          amount_cents: pi.amount,
          currency: pi.currency,
          status: "confirmed",
          source: "stripe_webhook",
          service_type: bd.service_type ?? "unknown",
          customer_name: bd.customer_name,
          customer_email: bd.customer_email,
          customer_phone: bd.customer_phone,
          customer_address: bd.customer_address,
          customer_address2: bd.customer_address2 ?? null,
          customer_zip: bd.customer_zip,
          customer_property_type: bd.customer_property_type,
          customer_gate_code: bd.customer_gate_code ?? null,
          schedule_date: bd.schedule_date,
          schedule_time_window: bd.schedule_time_window,
          items: bd.items ?? [],
          custom_items: bd.custom_items ?? [],
          item_total: bd.item_total ?? 0,
          photo_promo_discount: bd.photo_promo_discount ?? 0,
          adjusted_item_total: bd.adjusted_item_total ?? 0,
          minimum_price: bd.minimum_price ?? null,
          final_total: bd.final_total ?? 0,
          amount_charged: bd.amount_charged ?? (pi.amount / 100),
          deposit_mode: bd.deposit_mode ?? false,
          customer_ip: bd.customer_ip ?? null,
          terms_version: bd.terms_version ?? null,
          notes: bd.notes ?? null,
        }).select("id").single();

        if (error || !inserted) {
          await logEvent(null, "booking.create_failed", {
            payment_intent_id: pi.id, error: error?.message ?? "unknown",
          });
          skipped++;
          continue;
        }
        bookingId = inserted.id;
        confirmed++;
        await logEvent(bookingId, "reconciliation.auto_confirmed", {
          payment_intent_id: pi.id, amount_cents: pi.amount,
        });
      }

      await supabase
        .from("pending_bookings")
        .update({ status: "completed" })
        .eq("id", pending.id);

      // send-confirmation is idempotent (skips if email.sent already logged)
      const { data: emailRes } = await supabase.functions.invoke("send-confirmation", {
        body: { booking_id: bookingId, source: "reconciliation" },
      });
      if (emailRes?.sent) emailed++;

      // QuickBooks sync — optional add-on, idempotent, skips if not connected
      supabase.functions.invoke("create-qbo-receipt", {
        body: { booking_id: bookingId },
      }).catch(() => { /* logged inside create-qbo-receipt */ });
    } else if (pi.status === "canceled" || pi.status === "requires_payment_method") {
      // Payment failed or was abandoned — close out the pending booking.
      await supabase
        .from("pending_bookings")
        .update({ status: "failed" })
        .eq("id", pending.id);
      await logEvent(null, "booking.abandoned", {
        payment_intent_id: pi.id, stripe_status: pi.status,
      });
      abandoned++;
    }
    // 'processing' / 'requires_action' — leave it, retry next cycle.
  }

  return new Response(
    JSON.stringify({ checked: stalePending.length, confirmed, emailed, abandoned, skipped }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});
