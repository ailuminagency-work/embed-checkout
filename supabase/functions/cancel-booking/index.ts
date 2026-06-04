// Self-serve booking cancellation.
// Accepts a cancel_token, verifies policy window, cancels booking + Stripe refund.
// Silently skips if addon_cancellation_flow_enabled != 'true'.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, corsResponse, json, error as jsonError } from "../_shared/cors.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse();

  try {
    const { token } = await req.json() as { token: string };
    if (!token) return jsonError("Missing cancel token", 400);

    // Check add-on enabled
    const { data: settings } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", ["addon_cancellation_flow_enabled", "cancellation_window_hours"]);

    const cfg = Object.fromEntries((settings ?? []).map((r: { key: string; value: string }) => [r.key, r.value ?? ""]));

    if (cfg.addon_cancellation_flow_enabled !== "true") {
      return jsonError("Cancellation not available", 403);
    }

    const { data: booking, error: bErr } = await supabase
      .from("bookings")
      .select("*")
      .eq("cancel_token", token)
      .single();

    if (bErr || !booking) return jsonError("Invalid or expired cancellation link", 404);

    if (booking.status === "cancelled") {
      return json({ already_cancelled: true });
    }

    if (!["confirmed", "pending"].includes(booking.status)) {
      return jsonError("This booking cannot be cancelled", 400);
    }

    // Check cancellation window
    const windowHours = parseInt(cfg.cancellation_window_hours || "24", 10);
    if (booking.schedule_date) {
      const serviceDate = new Date(booking.schedule_date);
      const hoursUntilService = (serviceDate.getTime() - Date.now()) / (1000 * 60 * 60);
      if (hoursUntilService < windowHours) {
        return json({
          within_policy: false,
          message: `Cancellations must be made at least ${windowHours} hours before your scheduled service.`,
        });
      }
    }

    // Attempt Stripe refund if a payment was charged
    let refunded = false;
    if (booking.payment_id && booking.payment_id.startsWith("pi_")) {
      const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
      if (STRIPE_SECRET_KEY) {
        try {
          const refundRes = await fetch("https://api.stripe.com/v1/refunds", {
            method: "POST",
            headers: {
              Authorization: `Basic ${btoa(STRIPE_SECRET_KEY + ":")}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({ payment_intent: booking.payment_id }),
          });
          refunded = refundRes.ok;
        } catch (e) {
          console.warn("[cancel-booking] Stripe refund failed:", e);
        }
      }
    }

    await supabase.from("bookings").update({ status: "cancelled" }).eq("id", booking.id);

    // Fire cancellation webhook (best-effort)
    try {
      await supabase.functions.invoke("deliver-webhook", {
        body: { booking_id: booking.id, event: "booking.cancelled" },
      });
    } catch {
      // non-blocking
    }

    return json({ cancelled: true, refunded });
  } catch (e) {
    console.error("[cancel-booking]", e);
    return jsonError("Internal error", 500);
  }
});
