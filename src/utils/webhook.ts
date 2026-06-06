import { supabase } from "@/integrations/supabase/client";
import { BookingState } from "@/types/booking";

interface WebhookConfig {
  active_mode: string;
  test_url: string;
  live_url: string;
  twin_url: string;
}

async function getWebhookConfig(): Promise<WebhookConfig | null> {
  const { data, error } = await supabase
    .from("webhook_settings")
    .select("active_mode, test_url, live_url, twin_url")
    .limit(1)
    .single();
  if (error) {
    console.warn("[Webhook] Failed to fetch settings from DB, falling back to env config:", error.message);
    return null;
  }
  return data;
}

async function fireWebhook(label: string, url: string, mode: string, payload: object): Promise<void> {
  console.log(`[Webhook:${label}] Sending to: ${url}`);
  let statusCode: number | null = null;
  let success = false;
  let errorMessage: string | null = null;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    statusCode = res.status;
    success = res.ok;
    if (!res.ok) errorMessage = `HTTP ${res.status} ${res.statusText}`;
    console.log(`[Webhook:${label}] Response: ${res.status} ${res.statusText}`);
  } catch (e: unknown) {
    errorMessage = e instanceof Error ? e.message : "Network error";
    console.error(`[Webhook:${label}] Failed:`, e);
  }

  // Log to DB (fire-and-forget)
  supabase.from("webhook_logs").insert({
    webhook_url: url,
    mode,
    label,
    status_code: statusCode,
    success,
    error_message: errorMessage,
  }).then(() => {});
}

export async function sendBookingWebhook(
  state: BookingState,
  subtotal: number,
  total: number,
  payableAmount: number,
) {
  // Try DB settings first, fall back to env config
  const dbConfig = await getWebhookConfig();

  const mode = dbConfig?.active_mode || "test";
  const makeUrl = dbConfig
    ? (mode === "live" ? dbConfig.live_url : dbConfig.test_url)
    : "";
  const twinUrl = dbConfig?.twin_url || "";

  const payload = {
    serviceType: state.serviceType,
    items: state.cart.map((c) => ({
      id: c.item.id,
      name: c.item.name,
      price: c.item.price,
      quantity: c.quantity,
      lineTotal: c.item.price * c.quantity,
    })),
    customItems: state.customItems,
    subtotal,
    total,
    amountCharged: payableAmount,
    depositMode: false,
    schedule: {
      date: state.selectedDate?.toISOString(),
      timeWindow: state.selectedTimeWindow?.label,
    },
    customer: {
      name: state.customer.name,
      phone: state.customer.phone,
      email: state.customer.email,
      address: state.customer.address,
      zip: state.customer.zip,
      gateCode: state.customer.gateCode,
      notes: state.customer.notes,
    },
    stripePaymentId: state.paymentId,
    currency: "USD",
    webhookMode: mode,
    timestamp: new Date().toISOString(),
  };

  console.log(`[Webhook] Mode: ${mode} (source: ${dbConfig ? "database" : "env"})`);

  const requests: Promise<void>[] = [];

  if (makeUrl) {
    requests.push(fireWebhook(`Make:${mode}`, makeUrl, mode, payload));
  }

  if (twinUrl) {
    requests.push(fireWebhook("Twin", twinUrl, mode, payload));
  }

  if (requests.length === 0) {
    console.log("[Webhook] Skipped — no webhook URLs configured. Set URLs in the Webhooks admin page or env vars.");
    return;
  }

  await Promise.all(requests);
}
