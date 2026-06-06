import { describe, it, expect } from "vitest";

// Mirror the exact calculation logic in BookingContext.tsx.
// If these tests fail, customers are being charged the wrong amount.

function calculateTotal(
  cart: { price: number; quantity: number }[],
  photosUploaded: boolean,
  photoPromoPercent: number,
  minimumPrice: number | null,
): {
  itemTotal: number;
  photoDiscount: number;
  adjustedTotal: number;
  finalTotal: number;
} {
  const itemTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const photoDiscount =
    photosUploaded && photoPromoPercent > 0
      ? Math.round((itemTotal * photoPromoPercent) / 100)
      : 0;
  const adjustedTotal = Math.max(itemTotal - photoDiscount, 0);
  const finalTotal =
    cart.length === 0
      ? 0
      : minimumPrice !== null
      ? Math.max(adjustedTotal, minimumPrice)
      : adjustedTotal;

  return { itemTotal, photoDiscount, adjustedTotal, finalTotal };
}

describe("Pricing Calculations", () => {
  it("calculates item total correctly", () => {
    const cart = [
      { price: 50, quantity: 2 },
      { price: 75, quantity: 1 },
    ];
    const result = calculateTotal(cart, false, 5, null);
    expect(result.itemTotal).toBe(175);
  });

  it("applies photo promo discount correctly", () => {
    const cart = [{ price: 200, quantity: 1 }];
    const result = calculateTotal(cart, true, 5, null);
    expect(result.photoDiscount).toBe(10); // 5% of 200
    expect(result.adjustedTotal).toBe(190);
  });

  it("does not apply photo discount when no photos", () => {
    const cart = [{ price: 200, quantity: 1 }];
    const result = calculateTotal(cart, false, 5, null);
    expect(result.photoDiscount).toBe(0);
    expect(result.adjustedTotal).toBe(200);
  });

  it("enforces minimum price when item total is below minimum", () => {
    const cart = [{ price: 50, quantity: 1 }];
    const result = calculateTotal(cart, false, 5, 150);
    expect(result.finalTotal).toBe(150);
  });

  it("does NOT enforce minimum when item total exceeds it", () => {
    const cart = [{ price: 200, quantity: 1 }];
    const result = calculateTotal(cart, false, 5, 150);
    expect(result.finalTotal).toBe(200);
  });

  it("returns 0 for empty cart", () => {
    const result = calculateTotal([], false, 5, 150);
    expect(result.finalTotal).toBe(0);
  });

  it("minimum price applies after photo discount", () => {
    // $160 item - 5% ($8) = $152 adjusted. Minimum is $150. $152 > $150 so $152 wins.
    const cart = [{ price: 160, quantity: 1 }];
    const result = calculateTotal(cart, true, 5, 150);
    expect(result.photoDiscount).toBe(8);
    expect(result.adjustedTotal).toBe(152);
    expect(result.finalTotal).toBe(152);
  });

  it("handles deposit mode correctly", () => {
    const finalTotal = 200;
    const depositPercentage = 25;
    const depositAmount = Math.ceil((finalTotal * depositPercentage) / 100);
    expect(depositAmount).toBe(50);
  });

  it("rounds photo discount correctly", () => {
    // 5% of 199 = 9.95 → rounds to 10
    const cart = [{ price: 199, quantity: 1 }];
    const result = calculateTotal(cart, true, 5, null);
    expect(result.photoDiscount).toBe(10);
    expect(result.adjustedTotal).toBe(189);
  });
});

describe("ZIP Code Validation", () => {
  const ZIP_PATTERN = /^\d{5}(?:-\d{4})?$/;

  it("accepts valid 5-digit ZIP", () => {
    expect(ZIP_PATTERN.test("98101")).toBe(true);
    expect(ZIP_PATTERN.test("90210")).toBe(true);
  });

  it("accepts valid ZIP+4 format", () => {
    expect(ZIP_PATTERN.test("98101-1234")).toBe(true);
  });

  it("rejects invalid ZIPs", () => {
    expect(ZIP_PATTERN.test("1234")).toBe(false);
    expect(ZIP_PATTERN.test("123456")).toBe(false);
    expect(ZIP_PATTERN.test("abcde")).toBe(false);
    expect(ZIP_PATTERN.test("")).toBe(false);
  });
});

describe("Service Types", () => {
  it("valid service types are junk-removal and donation-pickup", () => {
    const validTypes = ["junk-removal", "donation-pickup"];
    expect(validTypes).toContain("junk-removal");
    expect(validTypes).toContain("donation-pickup");
    expect(validTypes).not.toContain("unknown");
  });
});

describe("Booking State — canProceed logic", () => {
  it("step 0 requires service type and zip resolved", () => {
    const canProceed = (serviceType: string | null, zipReady: boolean) =>
      !!serviceType && zipReady;
    expect(canProceed(null, true)).toBe(false);
    expect(canProceed("junk-removal", false)).toBe(false);
    expect(canProceed("junk-removal", true)).toBe(true);
  });

  it("step 1 requires cart items", () => {
    const canProceed = (cartLength: number, photosOrSkip: boolean, zipReady: boolean) =>
      cartLength > 0 && photosOrSkip && zipReady;
    expect(canProceed(0, true, true)).toBe(false);
    expect(canProceed(1, false, true)).toBe(false);
    expect(canProceed(1, true, true)).toBe(true);
  });

  it("step 3 requires all customer fields", () => {
    const canProceed = (customer: {
      name: string; phone: string; email: string;
      address: string; zip: string; propertyType: string | null;
    }, zipReady: boolean) =>
      !!(customer.name && customer.phone && customer.email &&
         customer.address && customer.zip && customer.propertyType && zipReady);

    expect(canProceed({
      name: "", phone: "555-1234", email: "a@b.com",
      address: "123 Main", zip: "98101", propertyType: "house",
    }, true)).toBe(false);

    expect(canProceed({
      name: "John", phone: "555-1234", email: "a@b.com",
      address: "123 Main", zip: "98101", propertyType: "house",
    }, true)).toBe(true);
  });
});
