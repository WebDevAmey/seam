import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { generateMerchantDay } from "../generator/generate-merchant-day.js";
import { prisma } from "../prisma.js";
import { detectLeaksForMerchant } from "./detect-for-merchant.js";

async function seedMerchant() {
  return prisma.merchant.create({
    data: { name: "Detector Test", email: `${randomUUID()}@example.com` },
  });
}

describe("detectLeaksForMerchant — against real generated data, scored against ground truth", () => {
  it("finds exactly the leaks the generator says it planted, correctly classed, no more, no fewer", async () => {
    const merchant = await seedMerchant();
    const { groundTruth } = await generateMerchantDay({
      merchantId: merchant.id,
      seed: 99,
      counts: { clean: 5, paymentBlocked: 3, issuerDowntime: 2, silentAbandon: 4, preCheckoutDrop: 3 },
    });

    const { created } = await detectLeaksForMerchant(merchant.id);
    expect(created).toBe(groundTruth.length);

    const leaks = await prisma.leak.findMany({ where: { merchantId: merchant.id } });
    expect(leaks).toHaveLength(groundTruth.length);

    const detectedByCheckout = new Map(leaks.map((l) => [l.checkoutId, l]));
    for (const truth of groundTruth) {
      const detected = detectedByCheckout.get(truth.checkoutId);
      expect(detected, `expected a leak for ${truth.checkoutId}`).toBeTruthy();
      expect(detected!.class).toBe(truth.class);
      expect(detected!.amountPaise).toBe(truth.amountPaise);
      expect(detected!.evidenceEventIds.length).toBeGreaterThan(0);
    }

    // and nothing was flagged for the 5 clean, successful checkouts
    const groundTruthIds = new Set(groundTruth.map((g) => g.checkoutId));
    for (const leak of leaks) {
      expect(leak.checkoutId).not.toBeNull();
      expect(groundTruthIds.has(leak.checkoutId!)).toBe(true);
    }
  });

  it("is idempotent — running it twice doesn't duplicate leaks", async () => {
    const merchant = await seedMerchant();
    await generateMerchantDay({
      merchantId: merchant.id,
      seed: 7,
      counts: { clean: 0, paymentBlocked: 2, issuerDowntime: 0, silentAbandon: 0, preCheckoutDrop: 0 },
    });

    const first = await detectLeaksForMerchant(merchant.id);
    const second = await detectLeaksForMerchant(merchant.id);

    expect(first.created).toBe(2);
    expect(second.created).toBe(0);
    const total = await prisma.leak.count({ where: { merchantId: merchant.id } });
    expect(total).toBe(2);
  });

  it("never writes a leak with zero evidence event ids", async () => {
    const merchant = await seedMerchant();
    await generateMerchantDay({
      merchantId: merchant.id,
      seed: 11,
      counts: { clean: 0, paymentBlocked: 1, issuerDowntime: 1, silentAbandon: 1, preCheckoutDrop: 1 },
    });

    await detectLeaksForMerchant(merchant.id);

    const leaks = await prisma.leak.findMany({ where: { merchantId: merchant.id } });
    expect(leaks.length).toBeGreaterThan(0);
    for (const leak of leaks) {
      expect(leak.evidenceEventIds.length).toBeGreaterThan(0);
    }
  });
});
