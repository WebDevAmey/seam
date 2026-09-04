import type { Prisma } from "@prisma/client";
import { Hono } from "hono";
import { requireEnv } from "../env.js";
import { prisma } from "../prisma.js";
import { verifyShopifyWebhookSignature } from "./hmac.js";

export const shopifyWebhookRoutes = new Hono();

// One webhook URL serves every shop the app is installed on — Shopify tells
// us which shop via a header, not the URL path (unlike Razorpay, where each
// merchant gets their own webhook URL). Handler still does nothing but
// verify + insert (PRD §6).
shopifyWebhookRoutes.post("/webhooks/shopify", async (c) => {
  const shopDomain = c.req.header("x-shopify-shop-domain");
  const topic = c.req.header("x-shopify-topic");
  const signature = c.req.header("x-shopify-hmac-sha256");
  const rawBody = await c.req.text();

  if (!shopDomain || !topic) {
    return c.json({ error: "missing shop domain or topic header" }, 400);
  }

  const clientSecret = requireEnv("SHOPIFY_CLIENT_SECRET");
  if (!verifyShopifyWebhookSignature(rawBody, signature, clientSecret)) {
    return c.json({ error: "invalid signature" }, 400);
  }

  const connection = await prisma.shopifyConnection.findUnique({ where: { shopDomain } });
  if (!connection) {
    return c.json({ error: "unknown shop" }, 404);
  }

  const body = JSON.parse(rawBody) as { id: number | string };
  const externalId = `${topic}:${body.id}`;

  await prisma.rawEvent.upsert({
    where: { source_externalId: { source: "shopify", externalId } },
    create: {
      merchantId: connection.merchantId,
      source: "shopify",
      eventType: topic,
      externalId,
      payload: body as unknown as Prisma.InputJsonValue,
      signatureVerified: true,
    },
    update: {},
  });

  return c.json({ ok: true });
});
