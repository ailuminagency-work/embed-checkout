// Change 3: Server-side payment amount calculation.
// The client sends cart items + ZIP — the server calculates the amount.
// This prevents users from manipulating the price in the browser.

import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CartItem { id: string; quantity: number; }
interface RequestBody { items: CartItem[]; zip_code: string; photos_uploaded: boolean; }

async function getSetting(key: string): Promise<string | null> {
  const { data } = await supabase.from("app_settings").select("value").eq("key", key).maybeSingle();
  return data?.value ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: RequestBody = await req.json();
    const { items, zip_code, photos_uploaded } = body;

    if (!items || items.length === 0) {
      return new Response(JSON.stringify({ error: "Cart is empty" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Fetch item prices from catalog (server-authoritative) ───────────────
    const { data: catalogRows, error: catalogErr } = await supabase
      .from("catalog_items").select("id, price").in("id", items.map((i) => i.id)).eq("active", true);

    if (catalogErr) throw new Error(`Catalog lookup failed: ${catalogErr.message}`);

    const priceMap = new Map((catalogRows ?? []).map((r) => [r.id, Number(r.price)]));
    let itemTotal = 0;
    for (const item of items) {
      const price = priceMap.get(item.id);
      if (price == null) throw new Error(`Unknown or inactive item: ${item.id}`);
      itemTotal += price * item.quantity;
    }

    // ── Fetch ZIP minimum price ─────────────────────────────────────────────
    let minimumPrice: number | null = null;
    if (zip_code) {
      const { data: zipRow } = await supabase.from("zip_pricing")
        .select("minimum_price").eq("zip_code", zip_code.trim()).eq("active", true).maybeSingle();
      minimumPrice = zipRow ? Number(zipRow.minimum_price) : null;
    }

    // ── Read business rules from app_settings ───────────────────────────────
    const [photoPromoStr, depositModeStr, depositPctStr, currencyStr] = await Promise.all([
      getSetting("photo_promo_percent"), getSetting("deposit_mode"),
      getSetting("deposit_percentage"), getSetting("currency"),
    ]);

    const photoPromoPercent = Number(photoPromoStr ?? 5);
    const depositMode = depositModeStr === "true";
    const depositPercentage = Number(depositPctStr ?? 25);
    const currency = (currencyStr ?? "USD").toLowerCase();

    // ── Server-side price calculation ───────────────────────────────────────
    const photoPromoDiscount = photos_uploaded && photoPromoPercent > 0
      ? Math.round((itemTotal * photoPromoPercent) / 100) : 0;
    const adjustedItemTotal = Math.max(itemTotal - photoPromoDiscount, 0);
    const total = minimumPrice != null ? Math.max(adjustedItemTotal, minimumPrice) : adjustedItemTotal;
    const payableAmount = depositMode ? Math.ceil((total * depositPercentage) / 100) : total;

    if (payableAmount <= 0) {
      return new Response(JSON.stringify({ error: "Calculated amount is zero" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Create Stripe PaymentIntent ─────────────────────────────────────────
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(payableAmount * 100),
      currency,
      automatic_payment_methods: { enabled: true },
      metadata: {
        item_total: String(itemTotal), photo_promo_discount: String(photoPromoDiscount),
        adjusted_item_total: String(adjustedItemTotal), minimum_price: String(minimumPrice ?? ""),
        final_total: String(total), deposit_mode: String(depositMode), zip_code,
      },
    });

    return new Response(JSON.stringify({
      client_secret: paymentIntent.client_secret,
      id: paymentIntent.id,
      verified_amount: payableAmount,
      breakdown: {
        item_total: itemTotal, photo_promo_discount: photoPromoDiscount,
        adjusted_item_total: adjustedItemTotal, minimum_price: minimumPrice,
        final_total: total, deposit_mode: depositMode, deposit_percentage: depositPercentage,
      },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[create-payment-intent]", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
