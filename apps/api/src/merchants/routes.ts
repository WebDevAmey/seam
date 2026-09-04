import { Hono } from "hono";
import { z } from "zod";
import { requireEnv } from "../env.js";
import { encrypt } from "../lib/crypto.js";
import { prisma } from "../prisma.js";
import { verifyRazorpayCredentials } from "./razorpay-client.js";

const createMerchantSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

const connectRazorpaySchema = z.object({
  keyId: z.string().min(1),
  keySecret: z.string().min(1),
  webhookSecret: z.string().min(1),
});

export const merchantRoutes = new Hono();

merchantRoutes.post("/merchants", async (c) => {
  const body = createMerchantSchema.parse(await c.req.json());
  const merchant = await prisma.merchant.create({ data: body });
  return c.json({ id: merchant.id }, 201);
});

// Not OAuth — see razorpay-client.ts for why. The merchant pastes their Test
// Mode Key ID + Key Secret; we prove they're real before ever storing them.
merchantRoutes.post("/merchants/:id/razorpay/connect", async (c) => {
  const merchantId = c.req.param("id");
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
