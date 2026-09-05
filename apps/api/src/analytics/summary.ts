import { prisma } from "../prisma.js";

export type DailyPoint = {
  date: string;
  leakAmountPaise: bigint;
  leaksCount: number;
  recoveredPaise: bigint;
};

export type AnalyticsSummary = {
  dailySeries: DailyPoint[];
  byClass: { class: string; count: number; amountPaise: bigint }[];
  byMethod: { method: string; attempts: number; failures: number }[];
  funnel: { leaksDetected: number; dispatched: number; blocked: number; needsApproval: number };
};

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Every number here is a real aggregation over this merchant's own rows —
 * nothing here is a display-layer estimate. Powers the dashboard's charts
 * (`/recovery` overview) the same way `generate-digest.ts` powers the
 * founder-brief text: same source data, different shape for a different
 * surface (a chart wants a series, a paragraph wants a sentence).
 */
export async function getAnalyticsSummary(
  merchantId: string,
  options: { days: number; now?: Date },
): Promise<AnalyticsSummary> {
  const now = options.now ?? new Date();
  const windowEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) + 24 * 3_600_000);
  const windowStart = new Date(windowEnd.getTime() - options.days * 24 * 3_600_000);

  const [leaks, actions, attempts] = await Promise.all([
    prisma.leak.findMany({ where: { merchantId, detectedAt: { gte: windowStart, lt: windowEnd } } }),
    prisma.recoveryAction.findMany({ where: { merchantId, createdAt: { gte: windowStart, lt: windowEnd } } }),
    prisma.paymentAttempt.findMany({ where: { merchantId, attemptedAt: { gte: windowStart, lt: windowEnd } } }),
  ]);

  const byDay = new Map<string, DailyPoint>();
  for (let i = 0; i < options.days; i++) {
    const day = new Date(windowStart.getTime() + i * 24 * 3_600_000);
    const key = dateKey(day);
    byDay.set(key, { date: key, leakAmountPaise: 0n, leaksCount: 0, recoveredPaise: 0n });
  }

  for (const leak of leaks) {
    const bucket = byDay.get(dateKey(leak.detectedAt));
    if (!bucket) continue;
    bucket.leakAmountPaise += leak.amountPaise;
    bucket.leaksCount += 1;
  }

  for (const action of actions) {
    if (action.state !== "DISPATCHED") continue;
    const bucket = byDay.get(dateKey(action.createdAt));
    if (!bucket) continue;
    bucket.recoveredPaise += action.evPaise;
  }

  const byClassMap = new Map<string, { count: number; amountPaise: bigint }>();
  for (const leak of leaks) {
    const entry = byClassMap.get(leak.class) ?? { count: 0, amountPaise: 0n };
    entry.count += 1;
    entry.amountPaise += leak.amountPaise;
    byClassMap.set(leak.class, entry);
  }

  const byMethodMap = new Map<string, { attempts: number; failures: number }>();
  for (const attempt of attempts) {
    const entry = byMethodMap.get(attempt.method) ?? { attempts: 0, failures: 0 };
    entry.attempts += 1;
    if (attempt.status === "failed") entry.failures += 1;
    byMethodMap.set(attempt.method, entry);
  }

  return {
    dailySeries: Array.from(byDay.values()),
    byClass: Array.from(byClassMap.entries()).map(([leakClass, v]) => ({ class: leakClass, ...v })),
    byMethod: Array.from(byMethodMap.entries()).map(([method, v]) => ({ method, ...v })),
    funnel: {
      leaksDetected: leaks.length,
      dispatched: actions.filter((a) => a.state === "DISPATCHED").length,
      blocked: actions.filter((a) => a.shieldVerdict === "BLOCK").length,
      needsApproval: actions.filter((a) => a.shieldVerdict === "NEEDS_APPROVAL").length,
    },
  };
}
