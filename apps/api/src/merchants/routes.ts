import { Hono } from "hono";
import { z } from "zod";
import { requireOwnMerchant, type AuthEnv } from "../auth/middleware.js";
import { requireEnv } from "../env.js";
import { encrypt } from "../lib/crypto.js";
import { prisma } from "../prisma.js";
import { verifyRazorpayCredentials } from "./razorpay-client.js";
import {
  buildInstallUrl,
  createState,
  decodeState,
  exchangeCodeForAccessToken,
  verifyShopifyCallbackHmac,
} from "./shopify-oauth.js";

const SHOPIFY_SCOPE = "read_orders,read_checkouts,read_customers";

const createMerchantSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

const connectRazorpaySchema = z.object({
  keyId: z.string().min(1),
  keySecret: z.string().min(1),
  webhookSecret: z.string().min(1),
});

export const merchantRoutes = new Hono<AuthEnv>();

merchantRoutes.post("/merchants", async (c) => {
  const body = createMerchantSchema.parse(await c.req.json());
  const merchant = await prisma.merchant.create({ data: body });
  return c.json({ id: merchant.id }, 201);
});

// Not OAuth — see razorpay-client.ts for why. The merchant pastes their Test
// Mode Key ID + Key Secret; we prove they're real before ever storing them.
merchantRoutes.post("/merchants/:id/razorpay/connect", requireOwnMerchant, async (c) => {
  const merchantId = c.get("merchantId");
  const body = connectRazorpaySchema.parse(await c.req.json());

  const isValid = await verifyRazorpayCredentials(body.keyId, body.keySecret);
  if (!isValid) {
    return c.json({ error: "Razorpay rejected these credentials" }, 422);
  }

  const encKey = requireEnv("DATASOURCE_ENC_KEY");
  const encrypted = {
    keyId: body.keyId,
    keySecret: encrypt(body.keySecret, encKey),
    webhookSecret: encrypt(body.webhookSecret, encKey),
    status: "CONNECTED" as const,
  };

  await prisma.razorpayConnection.upsert({
    where: { merchantId },
    create: { merchantId, ...encrypted },
    update: encrypted,
  });

  return c.json({ status: "CONNECTED" });
});

merchantRoutes.get("/merchants/:id/shopify/install", (c) => {
  const merchantId = c.req.param("id");
  const shop = c.req.query("shop");
  if (!shop) {
    return c.json({ error: "shop query param is required" }, 400);
  }

  const url = buildInstallUrl({
    shop,
    state: createState(merchantId),
    clientId: requireEnv("SHOPIFY_CLIENT_ID"),
    redirectUri: requireEnv("SHOPIFY_REDIRECT_URI"),
    scope: SHOPIFY_SCOPE,
  });

  return c.redirect(url);
});

merchantRoutes.get("/shopify/callback", async (c) => {
  const query = c.req.query();
  const clientSecret = requireEnv("SHOPIFY_CLIENT_SECRET");

  if (!verifyShopifyCallbackHmac(query, clientSecret)) {
    return c.json({ error: "invalid hmac" }, 400);
  }

  const { code, shop, state } = query;
  if (!code || !shop || !state) {
    return c.json({ error: "missing code, shop, or state" }, 400);
  }

  const { merchantId } = decodeState(state);
  const { accessToken, scope } = await exchangeCodeForAccessToken(
    shop,
    code,
    requireEnv("SHOPIFY_CLIENT_ID"),
    clientSecret,
  );

  const encryptedToken = encrypt(accessToken, requireEnv("DATASOURCE_ENC_KEY"));
  await prisma.shopifyConnection.upsert({
    where: { merchantId },
    create: { merchantId, shopDomain: shop, accessToken: encryptedToken, scope, status: "CONNECTED" },
    update: { shopDomain: shop, accessToken: encryptedToken, scope, status: "CONNECTED" },
  });

  return c.json({ status: "CONNECTED" });
});
