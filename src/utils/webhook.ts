import { BOOKING_CONFIG } from "@/config/booking";
import { BookingState } from "@/types/booking";

async function fireWebhook(label: string, url: string, payload: object): Promise<void> {
  console.log(`[Webhook:${label}] Sending to: ${url}`);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    console.log(`[Webhook:${label}] Response: ${res.status} ${res.statusText}`);
  } catch (e) {
    console.error(`[Webhook:${label}] Failed:`, e);
  }
}

export async function sendBookingWebhook(
  state: BookingState,
  subtotal: number,
  total: number,
  payableAmount: number,
) {
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
    depositMode: BOOKING_CONFIG.depositMode,
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
    currency: BOOKING_CONFIG.currency,
    webhookMode: BOOKING_CONFIG.webhookMode,
    timestamp: new Date().toISOString(),
  };

  console.log(`[Webhook] Mode: ${BOOKING_CONFIG.webhookMode}`);

  const requests: Promise<void>[] = [];

  if (BOOKING_CONFIG.webhookUrl) {
    requests.push(fireWebhook(`Make:${BOOKING_CONFIG.webhookMode}`, BOOKING_CONFIG.webhookUrl, payload));
  }

  if (BOOKING_CONFIG.twinWebhookUrl) {
    requests.push(fireWebhook("Twin", BOOKING_CONFIG.twinWebhookUrl, payload));
  }

  if (requests.length === 0) {
    console.log("[Webhook] Skipped — no webhook URLs configured. Set VITE_MAKE_WEBHOOK_URL_TEST or VITE_MAKE_WEBHOOK_URL_LIVE in your env.");
    return;
  }

  await Promise.all(requests);
}
