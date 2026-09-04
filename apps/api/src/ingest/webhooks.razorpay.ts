import type { Prisma } from "@prisma/client";
import { Hono } from "hono";
import { requireEnv } from "../env.js";
import { decrypt } from "../lib/crypto.js";
import { prisma } from "../prisma.js";
import { verifyRazorpayWebhookSignature } from "./hmac.js";

function extractEntityId(payload: Record<string, unknown>): string | null {
  for (const value of Object.values(payload)) {
    const entity = (value as { entity?: { id?: unknown } } | undefined)?.entity;
    if (entity && typeof entity.id === "string") return entity.id;
  }
  return null;
}

export const razorpayWebhookRoutes = new Hono();

// Handler does nothing but verify + insert. Ever. Everything else happens
// downstream, off a claimed RawEvent row (PRD §6).
razorpayWebhookRoutes.post("/webhooks/razorpay/:merchantId", async (c) => {
  const merchantId = c.req.param("merchantId");
  const rawBody = await c.req.text();
  const signature = c.req.header("x-razorpay-signature");

  const connection = await prisma.razorpayConnection.findUnique({ where: { merchantId } });
  if (!connection) {
    return c.json({ error: "unknown merchant" }, 404);
  }

  const encKey = requireEnv("DATASOURCE_ENC_KEY");
  const webhookSecret = decrypt(connection.webhookSecret, encKey);

  if (!verifyRazorpayWebhookSignature(rawBody, signature, webhookSecret)) {
    return c.json({ error: "invalid signature" }, 400);
  }

  const body = JSON.parse(rawBody) as { event: string; payload: Record<string, unknown> };
  const entityId = extractEntityId(body.payload);
  if (!entityId) {
    return c.json({ error: "no recognisable entity id in payload" }, 400);
  }
  const externalId = `${body.event}:${entityId}`;

  await prisma.rawEvent.upsert({
    where: { source_externalId: { source: "razorpay", externalId } },
    create: {
      merchantId,
      source: "razorpay",
      eventType: body.event,
      externalId,
      payload: body as unknown as Prisma.InputJsonValue,
      signatureVerified: true,
    },
    update: {}, // retried webhook, same event — already recorded, no-op
  });

  return c.json({ ok: true });
});
