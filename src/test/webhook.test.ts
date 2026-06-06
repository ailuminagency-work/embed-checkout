import { describe, it, expect } from "vitest";

describe("Webhook Payload Structure", () => {
  it("webhook payload contains all required fields", () => {
    const mockPayload = {
      event: "booking.confirmed",
      booking_id: "uuid-123",
      reference: "pi_stripe_123",
      service_type: "junk-removal",
      status: "confirmed",
      schedule: { date: "2026-06-10", time_window: "8:00 AM – 12:00 PM" },
      customer: {
        name: "John Smith",
        phone: "555-1234",
        email: "john@example.com",
        address: "123 Main St",
        zip: "98101",
        property_type: "house",
      },
      pricing: {
        item_total: 175,
        photo_promo_discount: 0,
        adjusted_item_total: 175,
        minimum_price: 150,
        final_total: 175,
        amount_charged: 175,
        deposit_mode: false,
      },
      payment_id: "pi_stripe_123",
      timestamp: new Date().toISOString(),
    };

    expect(mockPayload.event).toBeDefined();
    expect(mockPayload.customer.email).toBeDefined();
    expect(mockPayload.pricing.amount_charged).toBeGreaterThan(0);
    expect(mockPayload.schedule.date).toBeDefined();
    expect(mockPayload.schedule.time_window).toBeDefined();
  });

  it("amount_charged must equal final_total when deposit mode is off", () => {
    const finalTotal = 175;
    const depositMode = false;
    const depositPercentage = 25;
    const amountCharged = depositMode
      ? Math.ceil((finalTotal * depositPercentage) / 100)
      : finalTotal;
    expect(amountCharged).toBe(175);
  });

  it("amount_charged must equal deposit when deposit mode is on", () => {
    const finalTotal = 200;
    const depositMode = true;
    const depositPercentage = 25;
    const amountCharged = depositMode
      ? Math.ceil((finalTotal * depositPercentage) / 100)
      : finalTotal;
    expect(amountCharged).toBe(50);
  });
});
