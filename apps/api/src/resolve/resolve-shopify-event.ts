import { createHash } from "node:crypto";
import type { ClaimedRawEvent } from "../ingest/claim.js";
import { prisma } from "../prisma.js";

type ShopifyCheckoutPayload = {
  id?: number | string;
  email?: string;
  phone?: string;
  total_price?: string;
  created_at?: string;
};

function toPaise(totalPrice: string): bigint {
  // Shopify's total_price is a decimal-string rupee amount ("1299.00").
  const rupees = Number.parseFloat(totalPrice);
  return BigInt(Math.round(rupees * 100));
}

/**
 * Turns a claimed Shopify RawEvent into a FunnelEvent. Only `checkouts/create`
 * produces a checkout_start row today — that's the one stage the join engine
 * actually needs candidates for. Other topics (orders/*, refunds/*) are
 * real future leak-taxonomy signals (PRD §5) but aren't wired yet.
 */
export async function resolveShopifyEvent(event: ClaimedRawEvent): Promise<void> {
  if (event.eventType !== "checkouts/create") return;

  const body = event.payload as ShopifyCheckoutPayload;
  if (!body.id || !body.total_price) return;

  const checkoutId = String(body.id);
  const occurredAt = body.created_at ? new Date(body.created_at) : new Date();
  const customerRef = body.email
    ? `sha256:${createHash("sha256").update(body.email.trim().toLowerCase()).digest("hex")}`
    : `checkout:${checkoutId}`;

  await prisma.funnelEvent.upsert({
    where: { rawEventId: event.id },
    create: {
      merchantId: event.merchantId,
      checkoutId,
      customerRef,
      customerEmail: body.email ?? null,
      customerPhone: body.phone ?? null,
      stage: "checkout_start",
      occurredAt,
      amountPaise: toPaise(body.total_price),
      rawEventId: event.id,
    },
    update: {},
  });
}
