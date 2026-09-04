import { describe, expect, it } from "vitest";
import { extractPaymentForJoin } from "./extract-payment.js";

function razorpayPaymentPayload(entity: Record<string, unknown>) {
  return { event: "payment.failed", payload: { payment: { entity } } };
}

describe("extractPaymentForJoin", () => {
  it("pulls email, phone, amount, and timestamp from a payment.* payload", () => {
    const result = extractPaymentForJoin(
      razorpayPaymentPayload({
        id: "pay_123",
        email: "buyer@example.com",
        contact: "+919876543210",
        amount: 129900,
        created_at: 1_725_000_000,
      }),
    );
    expect(result).toEqual({
      notesCheckoutId: null,
      email: "buyer@example.com",
      phone: "+919876543210",
      amountPaise: 129900n,
      attemptedAt: new Date(1_725_000_000 * 1000),
    });
  });

  it("reads notes.checkout_id when the merchant's checkout stamped it (the primary join)", () => {
    const result = extractPaymentForJoin(
      razorpayPaymentPayload({
        id: "pay_123",
        amount: 100,
        created_at: 1_725_000_000,
        notes: { checkout_id: "gid://shopify/Checkout/abc" },
      }),
    );
    expect(result?.notesCheckoutId).toBe("gid://shopify/Checkout/abc");
  });

  it("returns null when notes.checkout_id isn't a string", () => {
    const result = extractPaymentForJoin(
      razorpayPaymentPayload({ id: "pay_123", amount: 100, created_at: 1, notes: { checkout_id: 123 } }),
    );
    expect(result?.notesCheckoutId).toBeNull();
  });

  it("returns null for a payload with no payment entity (not a payment event)", () => {
    expect(extractPaymentForJoin({ event: "order.paid", payload: { order: { entity: {} } } })).toBeNull();
  });

  it("returns null when required numeric fields are missing", () => {
    expect(extractPaymentForJoin(razorpayPaymentPayload({ id: "pay_123" }))).toBeNull();
  });
});
