import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { prisma } from "../prisma.js";
import { resolvePaymentEvent } from "./resolve-payment-event.js";
import { resolveShopifyEvent } from "./resolve-shopify-event.js";

async function seedMerchant() {
  return prisma.merchant.create({
    data: { name: "Resolve Pipeline Test", email: `${randomUUID()}@example.com` },
  });
}

describe("resolve pipeline — Shopify checkout → Razorpay payment, joined end to end", () => {
  it("joins a payment to its checkout via the scored fallback (no notes stamped)", async () => {
    const merchant = await seedMerchant();
    const checkoutId = `${randomUUID()}`;
    const now = new Date("2026-09-04T10:00:00Z");

    // Shopify side: a checkout_start FunnelEvent, as if `checkouts/create` was resolved.
    await resolveShopifyEvent({
      id: randomUUID(),
      merchantId: merchant.id,
      source: "shopify",
      eventType: "checkouts/create",
      payload: {
        id: checkoutId,
        email: "buyer@example.com",
        phone: "+919876543210",
        total_price: "1299.00",
        created_at: now.toISOString(),
      },
    });

    // Razorpay side: a payment.failed event for the *same* customer/amount,
    // arriving 30s later, with no notes.checkout_id — the realistic case.
    await resolvePaymentEvent({
      id: randomUUID(),
      merchantId: merchant.id,
      source: "razorpay",
      eventType: "payment.failed",
      payload: {
        event: "payment.failed",
        payload: {
          payment: {
            entity: {
              id: `pay_${randomUUID()}`,
              order_id: `order_${randomUUID()}`,
              email: "buyer@example.com",
              contact: "+919876543210",
              amount: 129900,
              method: "card",
              status: "failed",
              error_reason: "payment_failed",
              created_at: Math.floor(now.getTime() / 1000) + 30,
            },
          },
        },
      },
    });

    const attempt = await prisma.paymentAttempt.findFirst({ where: { merchantId: merchant.id } });
    expect(attempt?.checkoutId).toBe(checkoutId);
    expect(attempt?.joinMethod).toBe("fuzzy");
    expect(Number(attempt?.joinConfidence)).toBe(1); // email+phone+amount+timestamp all matched
    expect(attempt?.status).toBe("failed");
    expect(attempt?.errorReason).toBe("payment_failed");
  });

  it("joins instantly via notes.checkout_id when the merchant's checkout stamped it", async () => {
    const merchant = await seedMerchant();

    await resolvePaymentEvent({
      id: randomUUID(),
      merchantId: merchant.id,
      source: "razorpay",
      eventType: "payment.captured",
      payload: {
        event: "payment.captured",
        payload: {
          payment: {
            entity: {
              id: `pay_${randomUUID()}`,
              amount: 50000,
              method: "upi",
              status: "captured",
              created_at: Math.floor(Date.now() / 1000),
              notes: { checkout_id: "gid://shopify/Checkout/stamped-directly" },
            },
          },
        },
      },
    });

    const attempt = await prisma.paymentAttempt.findFirst({ where: { merchantId: merchant.id } });
    expect(attempt?.checkoutId).toBe("gid://shopify/Checkout/stamped-directly");
    expect(attempt?.joinMethod).toBe("notes");
    expect(Number(attempt?.joinConfidence)).toBe(1);
  });

  it("leaves checkoutId null when nothing plausible is nearby", async () => {
    const merchant = await seedMerchant();

    await resolvePaymentEvent({
      id: randomUUID(),
      merchantId: merchant.id,
      source: "razorpay",
      eventType: "payment.failed",
      payload: {
        event: "payment.failed",
        payload: {
          payment: {
            entity: {
              id: `pay_${randomUUID()}`,
              email: "nobody-else-has-this@example.com",
              amount: 42,
              created_at: Math.floor(Date.now() / 1000),
            },
          },
        },
      },
    });

    const attempt = await prisma.paymentAttempt.findFirst({ where: { merchantId: merchant.id } });
    expect(attempt?.checkoutId).toBeNull();
    expect(attempt?.joinMethod).toBe("none");
  });
});
