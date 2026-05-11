import { supabase } from "@/integrations/supabase/client";
import { BookingState } from "@/types/booking";
import { BOOKING_CONFIG } from "@/config/booking";

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

  const { error } = await supabase.functions.invoke("dispatch-webhook", { body: payload });
  if (error) {
    console.error("[Webhook] dispatch-webhook failed:", error.message);
  }
}
