import { prisma } from "../prisma.js";
import { computeDailyRates, detectMethodConcentration, type ConcentrationFinding } from "./method-concentration.js";

/**
 * Pulls a merchant's payment-attempt history, runs the concentration check,
 * and writes a `Leak` row (class METHOD_CONCENTRATION) for anything found —
 * closing the one leak class that's been in the taxonomy since Block 4 but
 * never had a real detector, because it never had real multi-day data to
 * analyze until now.
 */
export async function analyzeLeakIntelligence(
  merchantId: string,
  today: string,
): Promise<{ findings: ConcentrationFinding[]; leaksCreated: number }> {
  const attempts = await prisma.paymentAttempt.findMany({
    where: { merchantId },
    select: { id: true, method: true, status: true, attemptedAt: true, amountPaise: true },
  });

  const dailyRates = computeDailyRates(attempts);
  const findings = detectMethodConcentration(dailyRates, today);

  let leaksCreated = 0;
  for (const finding of findings) {
    const existing = await prisma.leak.findFirst({
      where: { merchantId, class: "METHOD_CONCENTRATION", checkoutId: `method:${finding.method}:${today}` },
    });
    if (existing) continue;

    const todaysAttempts = attempts.filter(
      (a) => a.method === finding.method && a.attemptedAt.toISOString().slice(0, 10) === today && a.status === "failed",
    );
    const evidenceEventIds = todaysAttempts.map((a) => a.id);
    if (evidenceEventIds.length === 0) continue; // no evidence, no leak — same invariant as every other detector

    const amountPaise = todaysAttempts.reduce((sum, a) => sum + a.amountPaise, 0n);

    await prisma.leak.create({
      data: {
        merchantId,
        class: "METHOD_CONCENTRATION",
        amountPaise,
        checkoutId: `method:${finding.method}:${today}`, // not a real checkout — this leak is structural, not per-checkout
        evidenceEventIds,
        confidence: 1,
      },
    });
    leaksCreated++;
  }

  return { findings, leaksCreated };
}
