import { randomUUID } from "node:crypto";
import { prisma } from "../prisma.js";
import { createRng, pick, randomInt } from "./rng.js";

const METHODS = ["card", "upi", "netbanking", "wallet"] as const;

// Not wall-clock `new Date()` — a fixed default so this is deterministic
// given a seed, same discipline generate-merchant-day.ts already follows.
// (An earlier version used real "now," which made results depend on
// exactly when the function ran — a real bug, caught because the same
// seed produced different results in a one-off debug run vs. the test
// suite, at two slightly different wall-clock times.)
const DEFAULT_ANCHOR = new Date("2026-09-04T00:00:00Z");

/**
 * Multi-day `PaymentAttempt` history — a different shape of synthetic data
 * from `generate-merchant-day.ts`, which only ever produces one day.
 * `METHOD_CONCENTRATION` needs a real 14-day-ish baseline to compare
 * against (PRD §5); one merchant-day structurally can't provide that.
 * These attempts aren't tied to real checkouts — the leak this feeds is
 * structural (a method's decline rate), not a per-checkout leak.
 *
 * Decline rates are applied deterministically (exactly `round(count *
 * rate)` of each method's attempts that day are marked failed), not via a
 * per-attempt coin flip — a Bernoulli trial at n≈15 has enough sampling
 * noise to occasionally fail to produce the rate it was asked for. Method
 * *assignment* still uses the seeded RNG; only the failed/captured split
 * within a method-day is deterministic. Every attempt's timestamp is kept
 * strictly within its own day (00:00–23:59 UTC) — an earlier version added
 * up to 20 hours to a 10:00 base, which could spill into the next
 * calendar day and quietly corrupt which day an attempt got bucketed into.
 */
export async function generatePaymentHistory(input: {
  merchantId: string;
  days: number;
  baselineDeclineRate: number;
  attemptsPerDay: number;
  seed: number;
  spike?: { method: (typeof METHODS)[number]; declineRate: number };
  anchorDate?: Date;
}): Promise<{ today: string }> {
  const rng = createRng(input.seed);
  const anchor = input.anchorDate ?? DEFAULT_ANCHOR;
  const anchorMidnight = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), anchor.getUTCDate()));

  let todayKey = "";

  for (let dayOffset = input.days - 1; dayOffset >= 0; dayOffset--) {
    const dayStart = new Date(anchorMidnight.getTime() - dayOffset * 24 * 3_600_000);
    const dateKey = dayStart.toISOString().slice(0, 10);
    if (dayOffset === 0) todayKey = dateKey;

    const methodForAttempt = Array.from({ length: input.attemptsPerDay }, () => pick(rng, METHODS));
    const countByMethod = new Map<string, number>();
    for (const m of methodForAttempt) countByMethod.set(m, (countByMethod.get(m) ?? 0) + 1);

    const declinedSoFar = new Map<string, number>();
    for (const method of methodForAttempt) {
      const isSpikeDay = dayOffset === 0 && input.spike && method === input.spike.method;
      const declineRate = isSpikeDay ? input.spike!.declineRate : input.baselineDeclineRate;
      const targetDeclined = Math.round((countByMethod.get(method) ?? 0) * declineRate);
      const soFar = declinedSoFar.get(method) ?? 0;
      const status = soFar < targetDeclined ? "failed" : "captured";
      declinedSoFar.set(method, soFar + (status === "failed" ? 1 : 0));

      // Strictly within [dayStart, dayStart + 23h59m] — never crosses into
      // the next calendar day.
      const offsetMs = randomInt(rng, 0, 23) * 3_600_000 + randomInt(rng, 0, 59) * 60_000;

      await prisma.paymentAttempt.create({
        data: {
          merchantId: input.merchantId,
          rzpPaymentId: `pay_hist_${randomUUID()}`,
          rzpOrderId: `order_hist_${randomUUID()}`,
          checkoutId: null,
          joinConfidence: null,
          joinMethod: "none",
          method,
          status,
          amountPaise: BigInt(randomInt(rng, 300, 5000) * 100),
          attemptedAt: new Date(dayStart.getTime() + offsetMs),
          errorReason: status === "failed" ? "card_declined" : null,
        },
      });
    }
  }

  return { today: todayKey };
}
