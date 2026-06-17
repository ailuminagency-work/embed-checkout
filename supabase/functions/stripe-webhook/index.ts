// Stripe webhook handler — the authoritative booking confirmation point.
// The system IS the webhook: it confirms the booking, sends the email itself,
// logs every step to booking_events, and fires the optional outbound webhook.
// Make.com/Zapier is a non-blocking add-on — never in the critical path.
//
// Idempotent: duplicate Stripe events are deduplicated via stripe_event_id UNIQUE.

import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

async function logEvent(
  bookingId: string | null,
  eventType: string,
  payload: Record<string, unknown>,
  source = "stripe_webhook",
) {
  try {
    await supabase.from("booking_events").insert({
      booking_id: bookingId, event_type: eventType, payload, source,
    });
  } catch { /* logging must never crash the main flow */ }
}

// Optional outbound integration (Make.com / Zapier). Best-effort, non-blocking:
// a failure here is just a log entry — the booking is already confirmed.
async function fireOutboundWebhook(bookingId: string, booking: Record<string, unknown>) {
  try {
    const { data: settings } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", ["outbound_webhook_url", "outbound_webhook_secret"]);
    const cfg = Object.fromEntries(
      (settings ?? []).map((s: { key: string; value: string | null }) => [s.key, s.value ?? ""]),
    );
    if (!cfg.outbound_webhook_url) return; // not configured — skip silently

    const payload = {
      event: "booking.confirmed",
      booking_id: bookingId,
      reference: booking.reference,
      service_type: booking.service_type,
      schedule: { date: booking.schedule_date, time_window: booking.schedule_time_window },
      customer: {
        name: booking.customer_name,
        email: booking.customer_email,
        phone: booking.customer_phone,
        address: booking.customer_address,
        zip: booking.customer_zip,
      },
      items: booking.items,
      amount_charged: booking.amount_charged,
      timestamp: new Date().toISOString(),
    };

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const body = JSON.stringify(payload);
    if (cfg.outbound_webhook_secret) {
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        "raw", encoder.encode(cfg.outbound_webhook_secret),
        { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
      );
      const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
      headers["X-Webhook-Signature"] = Array.from(new Uint8Array(signature))
        .map((b) => b.toString(16).padStart(2, "0")).join("");
    }

    const res = await fetch(cfg.outbound_webhook_url, { method: "POST", headers, body });
    await logEvent(bookingId, res.ok ? "outbound_webhook.sent" : "outbound_webhook.failed", {
      url: cfg.outbound_webhook_url, status: res.status,
    });
  } catch (err) {
    await logEvent(bookingId, "outbound_webhook.error", { error: String(err) });
  }
}

async function sendConfirmation(bookingId: string) {
  try {
    await supabase.functions.invoke("send-confirmation", {
      body: { booking_id: bookingId, source: "stripe_webhook" },
    });
  } catch (e) {
    await logEvent(bookingId, "email.failed", { error: String(e) });
  }
}

// QuickBooks Sales Receipt — optional add-on, best-effort, non-blocking.
// create-qbo-receipt skips silently if QuickBooks isn't connected.
async function createQBOReceipt(bookingId: string) {
  try {
    await supabase.functions.invoke("create-qbo-receipt", {
      body: { booking_id: bookingId },
    });
  } catch {
    // failure logged inside create-qbo-receipt — booking unaffected
  }
}

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
    await logEvent(null, "stripe_webhook.invalid_signature", {});
    return new Response("Invalid webhook signature", { status: 400 });
  }

  // Idempotency guard — Stripe retries deliveries; process each event once.
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

    // Did the browser already create the booking?
    const { data: existingBooking } = await supabase
      .from("bookings")
      .select("id")
      .eq("payment_intent_id", pi.id)
      .maybeSingle();

    if (existingBooking) {
      // Browser path: booking exists — mark pending done, ensure email goes out.
      if (pendingBookingId) {
        await supabase
          .from("pending_bookings")
          .update({ status: "completed" })
          .eq("id", pendingBookingId);
      }
      await supabase
        .from("bookings")
        .update({ payment_intent_id: pi.id, stripe_mode: stripeMode })
        .eq("id", existingBooking.id)
        .is("payment_intent_id", null);

      await logEvent(existingBooking.id, "booking.confirmed", {
        payment_intent_id: pi.id, amount_cents: pi.amount, path: "browser",
      });
      await sendConfirmation(existingBooking.id);
      await createQBOReceipt(existingBooking.id);

      const { data: full } = await supabase.from("bookings").select("*").eq("id", existingBooking.id).single();
      if (full) await fireOutboundWebhook(existingBooking.id, full);
    } else if (pendingBookingId) {
      // Recovery path: browser crashed/closed — confirm from pending_bookings.
      const { data: pending } = await supabase
        .from("pending_bookings")
        .select("booking_data")
        .eq("id", pendingBookingId)
        .eq("status", "pending")
        .maybeSingle();

      if (pending?.booking_data) {
        const bd = pending.booking_data as Record<string, unknown>;
        const { data: inserted, error: bookingError } = await supabase.from("bookings").insert({
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
        }).select("id").single();

        if (!bookingError && inserted) {
          await supabase
            .from("pending_bookings")
            .update({ status: "completed" })
            .eq("id", pendingBookingId);

          await logEvent(inserted.id, "booking.confirmed", {
            payment_intent_id: pi.id, amount_cents: pi.amount, path: "crash_recovery",
          });
          await sendConfirmation(inserted.id);
          await createQBOReceipt(inserted.id);

          const { data: full } = await supabase.from("bookings").select("*").eq("id", inserted.id).single();
          if (full) await fireOutboundWebhook(inserted.id, full);

          console.log(`[stripe-webhook] Booking recovered from crash: ${pi.id}`);
        } else {
          await logEvent(null, "booking.create_failed", {
            payment_intent_id: pi.id, error: bookingError?.message ?? "unknown",
          });
          console.error(`[stripe-webhook] Failed to recover booking: ${bookingError?.message}`);
          // Return 200 — the reconciliation cron retries within 5 minutes.
        }
      } else {
        await logEvent(null, "stripe_webhook.pending_not_found", { payment_intent_id: pi.id });
      }
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

  // Refunds are handled entirely in the Stripe Dashboard — no refund handling here.

  return new Response(JSON.stringify({ ok: true, event_type: event.type }), {
    status: 200, headers: { "Content-Type": "application/json" },
  });
});
