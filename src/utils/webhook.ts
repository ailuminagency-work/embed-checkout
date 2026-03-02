import { BOOKING_CONFIG } from "@/config/booking";
import { BookingState } from "@/types/booking";

export async function sendBookingWebhook(
  state: BookingState,
  subtotal: number,
  total: number,
  payableAmount: number,
) {
  if (!BOOKING_CONFIG.webhookUrl || BOOKING_CONFIG.webhookUrl.includes("YOUR-WEBHOOK-ID")) {
    console.log("[Webhook] Skipped — no webhook URL configured.");
    return;
  }

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
    timestamp: new Date().toISOString(),
  };

  try {
    await fetch(BOOKING_CONFIG.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    console.log("[Webhook] Sent successfully.");
  } catch (e) {
    console.error("[Webhook] Failed:", e);
  }
}
