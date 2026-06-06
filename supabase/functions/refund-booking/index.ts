// Refund a booking via Stripe. Accepts booking_id (admin) or cancel_token (self-serve).
// Enforces refund window policy from app_settings.refund_window_hours.

import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, corsResponse, json, error as jsonError } from "../_shared/cors.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return corsResponse();

  try {
    const { booking_id, cancel_token, reason = "requested_by_customer" } = await req.json();

    if (!booking_id && !cancel_token) {
      return jsonError("Missing booking_id or cancel_token", 400);
    }

    const { data: booking, error: bErr } = await supabase
      .from("bookings")
      .select("*")
      .eq(cancel_token ? "cancel_token" : "id", cancel_token ?? booking_id)
      .single();

    if (bErr || !booking) return jsonError("Booking not found", 404);

    if (booking.status === "cancelled") {
      return jsonError("Booking is already cancelled", 400);
    }

    const { data: settings } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", ["refund_window_hours", "stripe_mode"]);

    const config = Object.fromEntries(
      (settings ?? []).map((s: { key: string; value: string }) => [s.key, s.value]),
    );

    const refundWindowHours = parseInt(config.refund_window_hours ?? "24", 10);

    if (booking.schedule_date) {
      const serviceDate = new Date(booking.schedule_date);
      const hoursUntilBooking = (serviceDate.getTime() - Date.now()) / 3_600_000;
      if (hoursUntilBooking < refundWindowHours) {
        return json({
          error: `Cancellations must be made at least ${refundWindowHours} hours before the scheduled pickup.`,
          refundable: false,
        }, 400);
      }
    }

    const stripeMode = booking.stripe_mode ?? config.stripe_mode ?? "test";
    const stripeKey = Deno.env.get(
      stripeMode === "live" ? "STRIPE_SECRET_KEY_LIVE" : "STRIPE_SECRET_KEY_TEST",
    ) ?? Deno.env.get("STRIPE_SECRET_KEY") ?? "";

    if (!stripeKey) return jsonError("Payment system not configured", 503);

    const stripe = new Stripe(stripeKey, {
      apiVersion: "2023-10-16",
      httpClient: Stripe.createFetchHttpClient(),
    });

    const intentId = booking.payment_intent_id ?? booking.payment_id;
    if (!intentId) {
      // No Stripe payment on record — just cancel the booking directly
      await supabase.from("bookings").update({ status: "cancelled" }).eq("id", booking.id);
      return json({ ok: true, refunded: false });
    }

    const refund = await stripe.refunds.create({
      payment_intent: intentId,
      reason: reason as Stripe.RefundCreateParams.Reason,
    });

    await supabase.from("bookings").update({
      status: "cancelled",
      refund_id: refund.id,
      refunded_at: new Date().toISOString(),
      refund_amount_cents: refund.amount,
    }).eq("id", booking.id);

    return json({
      ok: true,
      refund_id: refund.id,
      refund_amount: refund.amount / 100,
      currency: refund.currency,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Refund failed";
    console.error("[refund-booking]", message);
    return jsonError(message, 500);
  }
});
