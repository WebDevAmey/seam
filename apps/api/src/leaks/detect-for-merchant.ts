import { prisma } from "../prisma.js";
import { classifyCheckout, type CheckoutTimeline, type DowntimeWindowFact } from "./classify-checkout.js";

/**
 * Groups a merchant's FunnelEvents and PaymentAttempts by checkout, runs
 * each through `classifyCheckout`, and writes any new leaks found. Safe to
 * call repeatedly — an existing Leak for the same (merchant, checkout,
 * class) is left alone rather than duplicated.
 */
export async function detectLeaksForMerchant(merchantId: string): Promise<{ created: number }> {
  const [funnelEvents, paymentAttempts, downtimeWindowRows] = await Promise.all([
    prisma.funnelEvent.findMany({ where: { merchantId } }),
    prisma.paymentAttempt.findMany({ where: { merchantId, checkoutId: { not: null } } }),
    prisma.downtimeWindow.findMany(),
  ]);

  const downtimeWindows: DowntimeWindowFact[] = downtimeWindowRows.map((w) => ({
    method: w.method,
    startedAt: w.startedAt,
    resolvedAt: w.resolvedAt,
  }));

  const checkoutIds = new Set<string>([
    ...funnelEvents.map((e) => e.checkoutId),
    ...paymentAttempts.map((a) => a.checkoutId!),
  ]);

  let created = 0;
  for (const checkoutId of checkoutIds) {
    const timeline: CheckoutTimeline = {
      checkoutId,
      funnelEvents: funnelEvents
        .filter((e) => e.checkoutId === checkoutId)
        .map((e) => ({ id: e.id, stage: e.stage, occurredAt: e.occurredAt, amountPaise: e.amountPaise })),
      paymentAttempts: paymentAttempts
        .filter((a) => a.checkoutId === checkoutId)
        .map((a) => ({
          id: a.id,
          status: a.status,
          method: a.method,
          attemptedAt: a.attemptedAt,
          amountPaise: a.amountPaise,
        })),
    };

    const leak = classifyCheckout(timeline, downtimeWindows);
    if (!leak) continue;

    const existing = await prisma.leak.findFirst({
      where: { merchantId, checkoutId, class: leak.class },
    });
    if (existing) continue;

    await prisma.leak.create({
      data: {
        merchantId,
        class: leak.class,
        amountPaise: leak.amountPaise,
        checkoutId: leak.checkoutId,
        evidenceEventIds: leak.evidenceEventIds,
        confidence: leak.confidence,
      },
    });
    created++;
  }

  return { created };
}
