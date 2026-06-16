// Server-side payment amount calculation + Stripe PaymentIntent creation.
// Amount is NEVER trusted from the browser — always computed here from catalog prices.
// Rate-limited per IP (3 failed attempts per hour).

import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const customerIp =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";

  try {
    // ── 1. Rate limiting ────────────────────────────────────────────────────
    const oneHourAgo = new Date(Date.now() - 3_600_000).toISOString();
    const { count: failCount } = await supabase
      .from("payment_events")
      .select("id", { count: "exact", head: true })
      .eq("event_type", "payment_failed")
      .eq("customer_ip", customerIp)
      .gte("created_at", oneHourAgo);

    if ((failCount ?? 0) >= 3) {
      return new Response(
        JSON.stringify({ error: "Too many failed attempts. Please try again in an hour or call us directly." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── 2. Load all config from app_settings ────────────────────────────────
    const { data: settings } = await supabase.from("app_settings").select("key, value");
    const config = Object.fromEntries(
      (settings ?? []).map((s: { key: string; value: string }) => [s.key, s.value]),
    );

    const stripeMode = config.stripe_mode ?? "test";
    const stripeSecretKey =
      Deno.env.get(stripeMode === "live" ? "STRIPE_SECRET_KEY_LIVE" : "STRIPE_SECRET_KEY_TEST") ??
      Deno.env.get("STRIPE_SECRET_KEY") ?? "";

    if (!stripeSecretKey) {
      return new Response(
        JSON.stringify({ error: "Payment system not configured. Please contact us to book." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2023-10-16",
      httpClient: Stripe.createFetchHttpClient(),
    });

    // ── 3. Parse request body ───────────────────────────────────────────────
    const body = await req.json();
    const {
      cart,
      zip_code,
      photos_uploaded,
      schedule_date,
      booking_data,
      currency = "usd",
    } = body as {
      cart: { id: string; price: number; quantity: number }[];
      zip_code: string;
      photos_uploaded: boolean;
      schedule_date: string;
      booking_data: Record<string, unknown>;
      currency?: string;
    };

    if (!cart || !Array.isArray(cart) || cart.length === 0) {
      return new Response(
        JSON.stringify({ error: "Cart is empty." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!schedule_date) {
      return new Response(
        JSON.stringify({ error: "No schedule date provided." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── 4. Capacity check ───────────────────────────────────────────────────
    const dailyCapacity = parseInt(config.daily_job_capacity ?? "999", 10);
    const { count: existingBookings } = await supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("schedule_date", schedule_date)
      .neq("status", "cancelled");

    if ((existingBookings ?? 0) >= dailyCapacity) {
      return new Response(
        JSON.stringify({ error: "This date is no longer available. Please select another date.", code: "DATE_FULL" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── 5. Server-side amount calculation ───────────────────────────────────
    // Fetch authoritative prices from catalog — never trust client-supplied prices.
    const { data: catalogRows } = await supabase
      .from("catalog_items")
      .select("id, price")
      .in("id", cart.map((i) => i.id))
      .eq("active", true);

    const priceMap = new Map((catalogRows ?? []).map((r: { id: string; price: number }) => [r.id, Number(r.price)]));
    let itemTotal = 0;
    for (const item of cart) {
      const price = priceMap.get(item.id);
      if (price == null) {
        return new Response(
          JSON.stringify({ error: `Item not found or inactive: ${item.id}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      itemTotal += price * item.quantity;
    }

    const photoPromoPercent = parseFloat(config.photo_promo_percent ?? "5");
    const photoDiscount =
      photos_uploaded && photoPromoPercent > 0
        ? Math.round((itemTotal * photoPromoPercent) / 100)
        : 0;
    const adjustedItemTotal = Math.max(itemTotal - photoDiscount, 0);

    // Service-area minimum only applies when ZIP restrictions are enabled.
    const enableZipRestrictions = config.enable_zip_restrictions !== "false";
    let minimumPrice: number | null = null;
    if (enableZipRestrictions && zip_code) {
      const { data: zipRow } = await supabase
        .from("zip_pricing")
        .select("minimum_price")
        .eq("zip_code", zip_code.trim())
        .eq("active", true)
        .maybeSingle();
      if (zipRow) minimumPrice = Number(zipRow.minimum_price);
    }

    const finalTotal =
      cart.length === 0 ? 0
        : minimumPrice !== null ? Math.max(adjustedItemTotal, minimumPrice)
        : adjustedItemTotal;

    const depositMode = config.deposit_mode === "true";
    const depositPercentage = parseFloat(config.deposit_percentage ?? "25");
    const chargeAmount = depositMode
      ? Math.ceil((finalTotal * depositPercentage) / 100)
      : finalTotal;

    if (chargeAmount <= 0) {
      return new Response(
        JSON.stringify({ error: "Invalid charge amount." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const amountCents = Math.round(chargeAmount * 100);

    // ── 6. Create pending booking record ────────────────────────────────────
    const { data: pendingBooking, error: pendingError } = await supabase
      .from("pending_bookings")
      .insert({
        booking_data: {
          ...booking_data,
          item_total: itemTotal,
          photo_promo_discount: photoDiscount,
          adjusted_item_total: adjustedItemTotal,
          minimum_price: minimumPrice,
          final_total: finalTotal,
          amount_charged: chargeAmount,
          deposit_mode: depositMode,
          stripe_mode: stripeMode,
          customer_ip: customerIp,
          terms_version: config.terms_version ?? "1.0",
        },
        stripe_mode: stripeMode,
      })
      .select("id")
      .single();

    if (pendingError || !pendingBooking) {
      throw new Error("Failed to create pending booking record.");
    }

    // ── 7. Create Stripe PaymentIntent ──────────────────────────────────────
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: currency.toLowerCase(),
      automatic_payment_methods: { enabled: true },
      receipt_email: (booking_data?.customer_email as string) ?? undefined,
      description: `${config.company_name ?? "Booking"} — ${booking_data?.service_type ?? "Service"} on ${schedule_date}`,
      metadata: {
        pending_booking_id: pendingBooking.id,
        service_type: (booking_data?.service_type as string) ?? "",
        schedule_date,
        customer_email: (booking_data?.customer_email as string) ?? "",
        customer_name: (booking_data?.customer_name as string) ?? "",
        customer_ip: customerIp,
        stripe_mode: stripeMode,
        verified_amount: chargeAmount.toString(),
      },
      payment_method_options: {
        card: { request_three_d_secure: "automatic" },
      },
    });

    // Link the PaymentIntent back to the pending booking
    await supabase
      .from("pending_bookings")
      .update({ payment_intent_id: paymentIntent.id })
      .eq("id", pendingBooking.id);

    // ── 8. Return to client ─────────────────────────────────────────────────
    return new Response(
      JSON.stringify({
        client_secret: paymentIntent.client_secret,
        payment_intent_id: paymentIntent.id,
        pending_booking_id: pendingBooking.id,
        verified_amount: chargeAmount,
        breakdown: {
          item_total: itemTotal,
          photo_discount: photoDiscount,
          minimum_price: minimumPrice,
          final_total: finalTotal,
          charge_amount: chargeAmount,
          deposit_mode: depositMode,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[create-payment-intent] Error:", message);
    return new Response(
      JSON.stringify({ error: "Payment initialisation failed. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
