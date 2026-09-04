import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { prisma } from "../prisma.js";
import { generateMerchantDay } from "./generate-merchant-day.js";

async function seedMerchant() {
  return prisma.merchant.create({
    data: { name: "Generator Test", email: `${randomUUID()}@example.com` },
  });
}

describe("generateMerchantDay", () => {
  it("is deterministic — same seed, same merchant, same ground truth shape", async () => {
    const merchantA = await seedMerchant();
    const merchantB = await seedMerchant();
    const counts = { clean: 3, paymentBlocked: 2, issuerDowntime: 1, silentAbandon: 2, preCheckoutDrop: 2 };

    const resultA = await generateMerchantDay({ merchantId: merchantA.id, seed: 123, counts });
    const resultB = await generateMerchantDay({ merchantId: merchantB.id, seed: 123, counts });

    const classesA = resultA.groundTruth.map((g) => g.class).sort();
    const classesB = resultB.groundTruth.map((g) => g.class).sort();
    expect(classesA).toEqual(classesB);
    expect(resultA.groundTruth).toHaveLength(2 + 1 + 2 + 2); // everything except "clean"
  });

  it("PAYMENT_BLOCKED: a checkout with a failed payment and no success", async () => {
    const merchant = await seedMerchant();
    const { groundTruth } = await generateMerchantDay({
      merchantId: merchant.id,
      seed: 1,
      counts: { clean: 0, paymentBlocked: 3, issuerDowntime: 0, silentAbandon: 0, preCheckoutDrop: 0 },
    });

    expect(groundTruth).toHaveLength(3);
    for (const leak of groundTruth) {
      expect(leak.class).toBe("PAYMENT_BLOCKED");
      const checkout = await prisma.funnelEvent.findFirst({
        where: { merchantId: merchant.id, checkoutId: leak.checkoutId, stage: "checkout_start" },
      });
      expect(checkout).toBeTruthy();
      const attempts = await prisma.paymentAttempt.findMany({
        where: { merchantId: merchant.id, checkoutId: leak.checkoutId },
      });
      expect(attempts.length).toBeGreaterThan(0);
      expect(attempts.every((a) => a.status === "failed")).toBe(true);
    }
  });

  it("ISSUER_DOWNTIME: the failed attempt's timestamp falls inside an active DowntimeWindow", async () => {
    const merchant = await seedMerchant();
    const { groundTruth } = await generateMerchantDay({
      merchantId: merchant.id,
      seed: 2,
      counts: { clean: 0, paymentBlocked: 0, issuerDowntime: 2, silentAbandon: 0, preCheckoutDrop: 0 },
    });

    const windows = await prisma.downtimeWindow.findMany();
    expect(windows.length).toBeGreaterThan(0);

    for (const leak of groundTruth) {
      expect(leak.class).toBe("ISSUER_DOWNTIME");
      const attempt = await prisma.paymentAttempt.findFirst({
        where: { merchantId: merchant.id, checkoutId: leak.checkoutId },
      });
      expect(attempt).toBeTruthy();
      const overlapsSomeWindow = windows.some(
        (w) =>
          w.method === attempt!.method &&
          attempt!.attemptedAt >= w.startedAt &&
          (w.resolvedAt === null || attempt!.attemptedAt <= w.resolvedAt),
      );
      expect(overlapsSomeWindow).toBe(true);
    }
  });

  it("SILENT_ABANDON: a checkout with zero payment attempts", async () => {
    const merchant = await seedMerchant();
    const { groundTruth } = await generateMerchantDay({
      merchantId: merchant.id,
      seed: 3,
      counts: { clean: 0, paymentBlocked: 0, issuerDowntime: 0, silentAbandon: 4, preCheckoutDrop: 0 },
    });

    expect(groundTruth).toHaveLength(4);
    for (const leak of groundTruth) {
      expect(leak.class).toBe("SILENT_ABANDON");
      const attempts = await prisma.paymentAttempt.count({
        where: { merchantId: merchant.id, checkoutId: leak.checkoutId },
      });
      expect(attempts).toBe(0);
    }
  });

  it("PRE_CHECKOUT_DROP: an add_to_cart event with no matching checkout_start", async () => {
    const merchant = await seedMerchant();
    const { groundTruth } = await generateMerchantDay({
      merchantId: merchant.id,
      seed: 4,
      counts: { clean: 0, paymentBlocked: 0, issuerDowntime: 0, silentAbandon: 0, preCheckoutDrop: 3 },
    });

    for (const leak of groundTruth) {
      expect(leak.class).toBe("PRE_CHECKOUT_DROP");
      const addToCart = await prisma.funnelEvent.findFirst({
        where: { merchantId: merchant.id, checkoutId: leak.checkoutId, stage: "add_to_cart" },
      });
      expect(addToCart).toBeTruthy();
      const checkoutStart = await prisma.funnelEvent.findFirst({
        where: { merchantId: merchant.id, checkoutId: leak.checkoutId, stage: "checkout_start" },
      });
      expect(checkoutStart).toBeNull();
    }
  });

  it("clean checkouts succeed and never appear in ground truth", async () => {
    const merchant = await seedMerchant();
    const { groundTruth } = await generateMerchantDay({
      merchantId: merchant.id,
      seed: 5,
      counts: { clean: 5, paymentBlocked: 0, issuerDowntime: 0, silentAbandon: 0, preCheckoutDrop: 0 },
    });

    expect(groundTruth).toHaveLength(0);
    const successes = await prisma.paymentAttempt.count({
      where: { merchantId: merchant.id, status: "captured" },
    });
    expect(successes).toBe(5);
  });
});
