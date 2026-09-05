import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { prisma } from "../prisma.js";
import { getAnalyticsSummary } from "./summary.js";

async function seedMerchant() {
  return prisma.merchant.create({
    data: { name: "Analytics Test", email: `${randomUUID()}@example.com` },
  });
}

describe("getAnalyticsSummary — real aggregation over a merchant's own data", () => {
  it("buckets leak amounts and recovered EV by day, only within the window", async () => {
    const merchant = await seedMerchant();
    const today = new Date("2026-09-04T00:00:00Z");
    const yesterday = new Date("2026-09-03T00:00:00Z");
    const outOfWindow = new Date("2026-08-01T00:00:00Z");

    await prisma.leak.create({
      data: {
        merchantId: merchant.id,
        class: "PAYMENT_BLOCKED",
        amountPaise: 10_000n,
        checkoutId: "c1",
        evidenceEventIds: ["fe1"],
        confidence: 1,
        detectedAt: today,
      },
    });
    await prisma.leak.create({
      data: {
        merchantId: merchant.id,
        class: "SILENT_ABANDON",
        amountPaise: 5_000n,
        checkoutId: "c2",
        evidenceEventIds: ["fe2"],
        confidence: 1,
        detectedAt: yesterday,
      },
    });
    await prisma.leak.create({
      data: {
        merchantId: merchant.id,
        class: "PAYMENT_BLOCKED",
        amountPaise: 999_999n,
        checkoutId: "c_old",
        evidenceEventIds: ["fe_old"],
        confidence: 1,
        detectedAt: outOfWindow,
      },
    });

    const summary = await getAnalyticsSummary(merchant.id, { days: 7, now: today });

    const todayBucket = summary.dailySeries.find((d) => d.date === "2026-09-04");
    const yesterdayBucket = summary.dailySeries.find((d) => d.date === "2026-09-03");
    expect(todayBucket?.leakAmountPaise).toBe(10_000n);
    expect(todayBucket?.leaksCount).toBe(1);
    expect(yesterdayBucket?.leakAmountPaise).toBe(5_000n);

    const total = summary.dailySeries.reduce((sum, d) => sum + d.leakAmountPaise, 0n);
    expect(total).toBe(15_000n);
  });

  it("returns one bucket per day in the window, even days with zero activity", async () => {
    const merchant = await seedMerchant();
    const summary = await getAnalyticsSummary(merchant.id, { days: 7, now: new Date("2026-09-04T00:00:00Z") });
    expect(summary.dailySeries).toHaveLength(7);
    expect(summary.dailySeries.every((d) => d.leakAmountPaise === 0n)).toBe(true);
    expect(summary.dailySeries[0]?.date).toBe("2026-08-29");
    expect(summary.dailySeries[6]?.date).toBe("2026-09-04");
  });

  it("aggregates recovered EV from dispatched actions on the day they were created", async () => {
    const merchant = await seedMerchant();
    const today = new Date("2026-09-04T00:00:00Z");
    const leak = await prisma.leak.create({
      data: {
        merchantId: merchant.id,
        class: "PAYMENT_BLOCKED",
        amountPaise: 10_000n,
        checkoutId: "c1",
        evidenceEventIds: ["fe1"],
        confidence: 1,
        detectedAt: today,
      },
    });
    await prisma.recoveryAction.create({
      data: {
        merchantId: merchant.id,
        checkoutId: "c1",
        leakId: leak.id,
        actionClass: "ALTERNATE_METHOD_LINK",
        state: "DISPATCHED",
        idempotencyKey: "k1",
        evPaise: 4_000n,
        shieldVerdict: "PASS",
        createdAt: today,
      },
    });

    const summary = await getAnalyticsSummary(merchant.id, { days: 7, now: today });
    const todayBucket = summary.dailySeries.find((d) => d.date === "2026-09-04");
    expect(todayBucket?.recoveredPaise).toBe(4_000n);
  });

  it("groups leaks by class within the window", async () => {
    const merchant = await seedMerchant();
    const now = new Date("2026-09-04T00:00:00Z");
    await prisma.leak.create({
      data: {
        merchantId: merchant.id,
        class: "PAYMENT_BLOCKED",
        amountPaise: 10_000n,
        checkoutId: "c1",
        evidenceEventIds: ["fe1"],
        confidence: 1,
        detectedAt: now,
      },
    });
    await prisma.leak.create({
      data: {
        merchantId: merchant.id,
        class: "PAYMENT_BLOCKED",
        amountPaise: 5_000n,
        checkoutId: "c2",
        evidenceEventIds: ["fe2"],
        confidence: 1,
        detectedAt: now,
      },
    });

    const summary = await getAnalyticsSummary(merchant.id, { days: 7, now });
    const blocked = summary.byClass.find((c) => c.class === "PAYMENT_BLOCKED");
    expect(blocked?.count).toBe(2);
    expect(blocked?.amountPaise).toBe(15_000n);
  });

  it("breaks payment attempts down by method with failure counts", async () => {
    const merchant = await seedMerchant();
    const now = new Date("2026-09-04T12:00:00Z");
    await prisma.paymentAttempt.createMany({
      data: [
        {
          merchantId: merchant.id,
          rzpPaymentId: `pay_${randomUUID()}`,
          rzpOrderId: `order_${randomUUID()}`,
          joinMethod: "none",
          method: "upi",
          status: "captured",
          amountPaise: 10_000n,
          attemptedAt: now,
        },
        {
          merchantId: merchant.id,
          rzpPaymentId: `pay_${randomUUID()}`,
          rzpOrderId: `order_${randomUUID()}`,
          joinMethod: "none",
          method: "upi",
          status: "failed",
          amountPaise: 10_000n,
          attemptedAt: now,
        },
        {
          merchantId: merchant.id,
          rzpPaymentId: `pay_${randomUUID()}`,
          rzpOrderId: `order_${randomUUID()}`,
          joinMethod: "none",
          method: "card",
          status: "captured",
          amountPaise: 10_000n,
          attemptedAt: now,
        },
      ],
    });

    const summary = await getAnalyticsSummary(merchant.id, { days: 7, now });
    const upi = summary.byMethod.find((m) => m.method === "upi");
    const card = summary.byMethod.find((m) => m.method === "card");
    expect(upi).toEqual({ method: "upi", attempts: 2, failures: 1 });
    expect(card).toEqual({ method: "card", attempts: 1, failures: 0 });
  });

  it("counts the recovery funnel by state and shield verdict", async () => {
    const merchant = await seedMerchant();
    const now = new Date("2026-09-04T00:00:00Z");
    const leak = await prisma.leak.create({
      data: {
        merchantId: merchant.id,
        class: "PAYMENT_BLOCKED",
        amountPaise: 10_000n,
        checkoutId: "c1",
        evidenceEventIds: ["fe1"],
        confidence: 1,
        detectedAt: now,
      },
    });
    await prisma.recoveryAction.createMany({
      data: [
        {
          merchantId: merchant.id,
          checkoutId: "c1",
          leakId: leak.id,
          actionClass: "ALTERNATE_METHOD_LINK",
          state: "DISPATCHED",
          idempotencyKey: "k1",
          evPaise: 4_000n,
          shieldVerdict: "PASS",
          createdAt: now,
        },
        {
          merchantId: merchant.id,
          checkoutId: "c2",
          leakId: leak.id,
          actionClass: "ALTERNATE_METHOD_LINK",
          state: "FAILED",
          idempotencyKey: "k2",
          evPaise: 100n,
          shieldVerdict: "BLOCK",
          shieldReason: "below floor",
          createdAt: now,
        },
        {
          merchantId: merchant.id,
          checkoutId: "c3",
          leakId: leak.id,
          actionClass: "ALTERNATE_METHOD_LINK",
          state: "RESERVED",
          idempotencyKey: "k3",
          evPaise: 9_000n,
          shieldVerdict: "NEEDS_APPROVAL",
          createdAt: now,
        },
      ],
    });

    const summary = await getAnalyticsSummary(merchant.id, { days: 7, now });
    expect(summary.funnel).toEqual({
      leaksDetected: 1,
      dispatched: 1,
      blocked: 1,
      needsApproval: 1,
    });
  });

  it("returns a clean zero-state for a merchant with no data at all", async () => {
    const merchant = await seedMerchant();
    const summary = await getAnalyticsSummary(merchant.id, { days: 7, now: new Date("2026-09-04T00:00:00Z") });
    expect(summary.byClass).toEqual([]);
    expect(summary.byMethod).toEqual([]);
    expect(summary.funnel).toEqual({ leaksDetected: 0, dispatched: 0, blocked: 0, needsApproval: 0 });
  });
});
