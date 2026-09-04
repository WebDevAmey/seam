import { createHmac, randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../prisma.js";
import { shopifyWebhookRoutes } from "./webhooks.shopify.js";

const CLIENT_SECRET = "shpss_test_client_secret";

beforeAll(() => {
  process.env.SHOPIFY_CLIENT_SECRET = CLIENT_SECRET;
});

async function seedConnectedShop(shopDomain: string) {
  const merchant = await prisma.merchant.create({
    data: { name: "Shopify Test Merchant", email: `${randomUUID()}@example.com` },
  });
  await prisma.shopifyConnection.create({
    data: {
      merchantId: merchant.id,
      shopDomain,
      accessToken: "irrelevant-for-this-test",
      scope: "read_orders,read_checkouts",
      status: "CONNECTED",
    },
  });
  return merchant;
}

function sign(body: string): string {
  return createHmac("sha256", CLIENT_SECRET).update(body, "utf8").digest("base64");
}

// Shopify ids are numeric in practice, but nothing here depends on that —
// id just has to be unique per test run. (source, externalId) is a global
// unique key, and this dev database persists across runs, so a fixed
// literal here collides with a previous run's row instead of creating a
// fresh one (caught by running the full suite, not this file alone).
function orderPayload() {
  return JSON.stringify({ id: randomUUID(), total_price: "1299.00", email: "buyer@example.com" });
}

function headers(shopDomain: string, topic: string, body: string) {
  return {
    "x-shopify-shop-domain": shopDomain,
    "x-shopify-topic": topic,
    "x-shopify-hmac-sha256": sign(body),
  };
}

describe("POST /webhooks/shopify", () => {
  it("verifies the signature, resolves the merchant by shop domain, and inserts a RawEvent", async () => {
    const shopDomain = `${randomUUID()}.myshopify.com`;
    const merchant = await seedConnectedShop(shopDomain);
    const body = orderPayload();

    const res = await shopifyWebhookRoutes.request("/webhooks/shopify", {
      method: "POST",
      body,
      headers: headers(shopDomain, "orders/create", body),
    });

    expect(res.status).toBe(200);
    const event = await prisma.rawEvent.findFirst({ where: { merchantId: merchant.id } });
    expect(event?.eventType).toBe("orders/create");
    expect(event?.signatureVerified).toBe(true);
  });

  it("rejects an invalid signature and inserts nothing", async () => {
    const shopDomain = `${randomUUID()}.myshopify.com`;
    await seedConnectedShop(shopDomain);
    const body = orderPayload();

    const res = await shopifyWebhookRoutes.request("/webhooks/shopify", {
      method: "POST",
      body,
      headers: {
        "x-shopify-shop-domain": shopDomain,
        "x-shopify-topic": "orders/create",
        "x-shopify-hmac-sha256": Buffer.from("garbage").toString("base64"),
      },
    });

    expect(res.status).toBe(400);
  });

  it("dedupes a retried webhook", async () => {
    const shopDomain = `${randomUUID()}.myshopify.com`;
    const merchant = await seedConnectedShop(shopDomain);
    const body = orderPayload();
    const h = headers(shopDomain, "orders/create", body);

    await shopifyWebhookRoutes.request("/webhooks/shopify", { method: "POST", body, headers: h });
    await shopifyWebhookRoutes.request("/webhooks/shopify", { method: "POST", body, headers: h });

    const count = await prisma.rawEvent.count({ where: { merchantId: merchant.id } });
    expect(count).toBe(1);
  });

  it("404s for a shop domain with no connection", async () => {
    const body = orderPayload();
    const shopDomain = `${randomUUID()}.myshopify.com`;
    const res = await shopifyWebhookRoutes.request("/webhooks/shopify", {
      method: "POST",
      body,
      headers: headers(shopDomain, "orders/create", body),
    });
    expect(res.status).toBe(404);
  });
});
