import type { CheckoutCandidate } from "../join/resolve.js";
import { prisma } from "../prisma.js";

const CANDIDATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour either side of the payment attempt

/** Checkout-start events for this merchant near enough in time to plausibly
 * be the checkout a given payment attempt belongs to. A generous window —
 * `resolveJoin`'s scoring, not this query, is what actually narrows it down. */
export async function fetchCheckoutCandidates(
  merchantId: string,
  around: Date,
): Promise<CheckoutCandidate[]> {
  const rows = await prisma.funnelEvent.findMany({
    where: {
      merchantId,
      stage: "checkout_start",
      occurredAt: {
        gte: new Date(around.getTime() - CANDIDATE_WINDOW_MS),
        lte: new Date(around.getTime() + CANDIDATE_WINDOW_MS),
      },
    },
  });

  return rows.map((row) => ({
    checkoutId: row.checkoutId,
    customerEmail: row.customerEmail,
    customerPhone: row.customerPhone,
    amountPaise: row.amountPaise,
    occurredAt: row.occurredAt,
  }));
}
