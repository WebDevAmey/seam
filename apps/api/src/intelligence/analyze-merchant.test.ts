import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { generatePaymentHistory } from "../generator/generate-payment-history.js";
import { prisma } from "../prisma.js";
import { analyzeLeakIntelligence } from "./analyze-merchant.js";

describe("analyzeLeakIntelligence — against real generated 14-day history", () => {
  it("finds a real method-concentration spike and writes a Leak with evidence", async () => {
    const merchant = await prisma.merchant.create({
      data: { name: "Intelligence Test", email: `${randomUUID()}@example.com` },
    });

    const { today } = await generatePaymentHistory({
      merchantId: merchant.id,
      days: 14,
      baselineDeclineRate: 0.1,
      attemptsPerDay: 60,
      seed: 500,
      spike: { method: "upi", declineRate: 0.85 },
    });

    const result = await analyzeLeakIntelligence(merchant.id, today);

    expect(result.findings.some((f) => f.method === "upi")).toBe(true);
    expect(result.leaksCreated).toBeGreaterThan(0);

    const leak = await prisma.leak.findFirst({ where: { merchantId: merchant.id, class: "METHOD_CONCENTRATION" } });
    expect(leak).toBeTruthy();
    expect(leak!.evidenceEventIds.length).toBeGreaterThan(0);
    expect(leak!.amountPaise).toBeGreaterThan(0n);
  });

  it("finds nothing when decline rates are steady across all methods", async () => {
    const merchant = await prisma.merchant.create({
      data: { name: "Intelligence Test 2", email: `${randomUUID()}@example.com` },
    });

    const { today } = await generatePaymentHistory({
      merchantId: merchant.id,
      days: 14,
      baselineDeclineRate: 0.12,
      attemptsPerDay: 60,
      seed: 501,
    });

    const result = await analyzeLeakIntelligence(merchant.id, today);
    expect(result.findings).toHaveLength(0);
    expect(result.leaksCreated).toBe(0);
  });

  it("is idempotent — running it twice for the same day doesn't duplicate the leak", async () => {
    const merchant = await prisma.merchant.create({
      data: { name: "Intelligence Test 3", email: `${randomUUID()}@example.com` },
    });
    const { today } = await generatePaymentHistory({
      merchantId: merchant.id,
      days: 14,
      baselineDeclineRate: 0.1,
      attemptsPerDay: 60,
      seed: 502,
      spike: { method: "card", declineRate: 0.9 },
    });

    const first = await analyzeLeakIntelligence(merchant.id, today);
    const second = await analyzeLeakIntelligence(merchant.id, today);

    expect(first.leaksCreated).toBeGreaterThan(0);
    expect(second.leaksCreated).toBe(0);
    const count = await prisma.leak.count({ where: { merchantId: merchant.id, class: "METHOD_CONCENTRATION" } });
    expect(count).toBe(first.leaksCreated);
  });
});
