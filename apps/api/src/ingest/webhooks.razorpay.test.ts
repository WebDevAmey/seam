import { createHmac, randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { encrypt } from "../lib/crypto.js";
import { prisma } from "../prisma.js";
import { razorpayWebhookRoutes } from "./webhooks.razorpay.js";

const ENC_KEY = "test-env-encryption-key";
const WEBHOOK_SECRET = "whsec_test_secret";

beforeAll(() => {
  process.env.DATASOURCE_ENC_KEY = ENC_KEY;
});

async function seedConnectedMerchant() {
  const merchant = await prisma.merchant.create({
    data: { name: "Webhook Test Merchant", email: `${randomUUID()}@example.com` },
  });
  await prisma.razorpayConnection.create({
    data: {
      merchantId: merchant.id,
      keyId: "rzp_test_fake",
      keySecret: encrypt("fake-secret", ENC_KEY),
      webhookSecret: encrypt(WEBHOOK_SECRET, ENC_KEY),
      status: "CONNECTED",
    },
  });
  return merchant;
}

function sign(body: string): string {
  return createHmac("sha256", WEBHOOK_SECRET).update(body).digest("hex");
}

function paymentFailedPayload(paymentId: string) {
  return JSON.stringify({
    event: "payment.failed",
    payload: { payment: { entity: { id: paymentId, status: "failed" } } },
  });
}

describe("POST /webhooks/razorpay/:merchantId", () => {
  it("verifies the signature, inserts a RawEvent, and returns fast", async () => {
    const merchant = await seedConnectedMerchant();
    const body = paymentFailedPayload(`pay_${randomUUID()}`);

    const res = await razorpayWebhookRoutes.request(`/webhooks/razorpay/${merchant.id}`, {
      method: "POST",
      body,
      headers: { "x-razorpay-signature": sign(body) },
    });

    expect(res.status).toBe(200);
    const event = await prisma.rawEvent.findFirst({ where: { merchantId: merchant.id } });
    expect(event?.eventType).toBe("payment.failed");
    expect(event?.signatureVerified).toBe(true);
  });

  it("rejects an invalid signature and inserts nothing", async () => {
    const merchant = await seedConnectedMerchant();
    const body = paymentFailedPayload(`pay_${randomUUID()}`);

    const res = await razorpayWebhookRoutes.request(`/webhooks/razorpay/${merchant.id}`, {
      method: "POST",
      body,
      headers: { "x-razorpay-signature": "0".repeat(64) },
    });

    expect(res.status).toBe(400);
    const count = await prisma.rawEvent.count({ where: { merchantId: merchant.id } });
    expect(count).toBe(0);
  });

  it("dedupes a retried webhook instead of erroring or double-inserting", async () => {
    const merchant = await seedConnectedMerchant();
    const body = paymentFailedPayload(`pay_${randomUUID()}`);
    const headers = { "x-razorpay-signature": sign(body) };

    const first = await razorpayWebhookRoutes.request(`/webhooks/razorpay/${merchant.id}`, {
      method: "POST",
      body,
      headers,
    });
    const second = await razorpayWebhookRoutes.request(`/webhooks/razorpay/${merchant.id}`, {
      method: "POST",
      body,
      headers,
    });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    const count = await prisma.rawEvent.count({ where: { merchantId: merchant.id } });
    expect(count).toBe(1);
  });

  it("404s for a merchant with no Razorpay connection", async () => {
    const res = await razorpayWebhookRoutes.request(`/webhooks/razorpay/${randomUUID()}`, {
      method: "POST",
      body: paymentFailedPayload("pay_x"),
      headers: { "x-razorpay-signature": "irrelevant" },
    });
    expect(res.status).toBe(404);
  });
});
