// Stripe webhook handler — authoritative source for booking creation.
// Handles: payment_intent.succeeded, payment_intent.payment_failed, charge.refunded
// Idempotent: duplicate Stripe events are deduplicated via stripe_event_id UNIQUE constraint.

import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req: Request) => {
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Missing stripe-signature header", { status: 400 });
  }

  const body = await req.text();

  // Try all known secret name patterns so both simple and test/live setups work
  const secrets = [
    Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "",
    Deno.env.get("STRIPE_WEBHOOK_SECRET_LIVE") ?? "",
    Deno.env.get("STRIPE_WEBHOOK_SECRET_TEST") ?? "",
  ].filter(Boolean);

  let event: Stripe.Event | null = null;

  for (const secret of secrets) {
    try {
      const stripe = new Stripe("sk_test_placeholder", {
        apiVersion: "2023-10-16",
        httpClient: Stripe.createFetchHttpClient(),
      });
      event = await stripe.webhooks.constructEventAsync(body, signature, secret);
      break;
    } catch {
      continue;
    }
  }

  if (!event) {
    return new Response("Invalid webhook signature", { status: 400 });
  }

  // Idempotency guard
  const { data: existing } = await supabase
    .from("payment_events")
    .select("id")
    .eq("stripe_event_id", event.id)
    .maybeSingle();

  if (existing) {
    return new Response(JSON.stringify({ ok: true, duplicate: true }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  }

  const stripeMode = event.livemode ? "live" : "test";

  // ── payment_intent.succeeded ──────────────────────────────────────────────
  if (event.type === "payment_intent.succeeded") {
    const pi = event.data.object as Stripe.PaymentIntent;
    const metadata = pi.metadata;
    const pendingBookingId = metadata.pending_booking_id;

    await supabase.from("payment_events").insert({
      payment_intent_id: pi.id,
      stripe_event_id: event.id,
      event_type: "payment_succeeded",
      stripe_mode: stripeMode,
      amount_cents: pi.amount,
      currency: pi.currency,
      customer_email: metadata.customer_email ?? null,
    });

    // Check if browser already created the booking
    const { data: existingBooking } = await supabase
      .from("bookings")
      .select("id")
      .eq("payment_intent_id", pi.id)
      .maybeSingle();

    if (!existingBooking && pendingBookingId) {
      // Browser crashed / closed — recover from pending_bookings
      const { data: pending } = await supabase
        .from("pending_bookings")
        .select("booking_data")
        .eq("id", pendingBookingId)
        .eq("status", "pending")
        .maybeSingle();

      if (pending?.booking_data) {
        const bd = pending.booking_data as Record<string, unknown>;
        const { error: bookingError } = await supabase.from("bookings").insert({
          reference: pi.id,
          payment_id: pi.id,
          payment_intent_id: pi.id,
          stripe_mode: stripeMode,
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
        });

        if (!bookingError) {
          await supabase
            .from("pending_bookings")
            .update({ status: "completed" })
            .eq("id", pendingBookingId);

          await supabase.functions.invoke("send-confirmation", {
            body: {
              customerName: bd.customer_name,
              customerEmail: bd.customer_email,
              serviceType: bd.service_type,
              scheduleDate: bd.schedule_date,
              timeWindow: bd.schedule_time_window,
              items: bd.items,
              total: bd.amount_charged ?? pi.amount / 100,
              reference: pi.id,
            },
          });

          console.log(`[stripe-webhook] Booking recovered from crash: ${pi.id}`);
        } else {
          console.error(`[stripe-webhook] Failed to recover booking: ${bookingError.message}`);
        }
      }
    } else if (existingBooking) {
      // Browser completed it — mark pending as done
      if (pendingBookingId) {
        await supabase
          .from("pending_bookings")
          .update({ status: "completed" })
          .eq("id", pendingBookingId);
      }
      // Stamp payment_intent_id onto the booking if not already set
      await supabase
        .from("bookings")
        .update({ payment_intent_id: pi.id, stripe_mode: stripeMode })
        .eq("id", existingBooking.id)
        .is("payment_intent_id", null);
    }
  }

  // ── payment_intent.payment_failed ─────────────────────────────────────────
  if (event.type === "payment_intent.payment_failed") {
    const pi = event.data.object as Stripe.PaymentIntent;

    await supabase.from("payment_events").insert({
      payment_intent_id: pi.id,
      stripe_event_id: event.id,
      event_type: "payment_failed",
      stripe_mode: stripeMode,
      amount_cents: pi.amount,
      currency: pi.currency,
      customer_email: pi.metadata.customer_email ?? null,
      customer_ip: pi.metadata.customer_ip ?? null,
      error_code: pi.last_payment_error?.code ?? null,
      error_message: pi.last_payment_error?.message ?? null,
    });

    const pendingBookingId = pi.metadata.pending_booking_id;
    if (pendingBookingId) {
      await supabase
        .from("pending_bookings")
        .update({ status: "failed" })
        .eq("id", pendingBookingId);
    }
  }

  // ── charge.refunded ───────────────────────────────────────────────────────
  if (event.type === "charge.refunded") {
    const charge = event.data.object as Stripe.Charge;
    const refund = charge.refunds?.data?.[0];

    await supabase
      .from("bookings")
      .update({
        status: "cancelled",
        refund_id: refund?.id ?? null,
        refunded_at: new Date().toISOString(),
        refund_amount_cents: refund?.amount ?? charge.amount_refunded,
      })
      .eq("payment_intent_id", charge.payment_intent as string);

    await supabase.from("payment_events").insert({
      payment_intent_id: charge.payment_intent as string,
      stripe_event_id: event.id,
      event_type: "refunded",
      stripe_mode: stripeMode,
      amount_cents: refund?.amount ?? charge.amount_refunded,
      currency: charge.currency,
    });
  }

  return new Response(JSON.stringify({ ok: true, event_type: event.type }), {
    status: 200, headers: { "Content-Type": "application/json" },
  });
});
