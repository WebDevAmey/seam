import { prisma } from "../prisma.js";
import { buildDigestNarrative, type DigestData } from "./build-narrative.js";

export async function generateDigest(
  merchantId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<DigestData & { narrative: string }> {
  const [leaks, actions] = await Promise.all([
    prisma.leak.findMany({
      where: { merchantId, detectedAt: { gte: periodStart, lt: periodEnd } },
    }),
    prisma.recoveryAction.findMany({
      where: { merchantId, createdAt: { gte: periodStart, lt: periodEnd } },
    }),
  ]);

  const byClass = new Map<string, { count: number; amountPaise: bigint }>();
  let totalLeakAmountPaise = 0n;
  for (const leak of leaks) {
    const bucket = byClass.get(leak.class) ?? { count: 0, amountPaise: 0n };
    bucket.count += 1;
    bucket.amountPaise += leak.amountPaise;
    byClass.set(leak.class, bucket);
    totalLeakAmountPaise += leak.amountPaise;
  }

  const dispatched = actions.filter((a) => a.state === "DISPATCHED");
  const blocked = actions.filter((a) => a.shieldVerdict === "BLOCK");

  const reasonCounts = new Map<string, number>();
  for (const action of blocked) {
    const reason = action.shieldReason ?? "unspecified";
    reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
  }

  const data: DigestData = {
    periodStart: periodStart.toISOString().slice(0, 10),
    periodEnd: periodEnd.toISOString().slice(0, 10),
    leaksDetected: leaks.length,
    leaksByClass: Array.from(byClass.entries()).map(([leakClass, v]) => ({ class: leakClass, ...v })),
    totalLeakAmountPaise,
    actionsDispatched: dispatched.length,
    actionsBlocked: blocked.length,
    netRecoveredPaise: dispatched.reduce((sum, a) => sum + a.evPaise, 0n),
    shieldBlockReasons: Array.from(reasonCounts.entries()).map(([reason, count]) => ({ reason, count })),
  };

  return { ...data, narrative: buildDigestNarrative(data) };
}
