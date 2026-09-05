import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { prisma } from "../prisma.js";
import { findOpportunities } from "./opportunities.js";

async function seedMerchant() {
  return prisma.merchant.create({ data: { name: "Opportunities Test", email: `${randomUUID()}@example.com` } });
}

const NOW = new Date("2026-09-04T12:00:00Z"); // clear of quiet hours

describe("findOpportunities — a real dry-run of decide()+evaluateShield() over unaddressed leaks", () => {
  it("would_dispatch a PAYMENT_BLOCKED leak with a clean decline reason and no existing action", async () => {
    const merchant = await seedMerchant();
    const leak = await prisma.leak.create({
      data: {
        merchantId: merchant.id,
        class: "PAYMENT_BLOCKED",
        amountPaise: 100_000n,
        checkoutId: "c1",
        evidenceEventIds: ["fe1"],
        confidence: 1,
      },
    });
    await prisma.paymentAttempt.create({
      data: {
        merchantId: merchant.id,
        rzpPaymentId: `pay_${randomUUID()}`,
        rzpOrderId: `order_${randomUUID()}`,
        checkoutId: "c1",
        joinMethod: "notes",
        method: "card",
        status: "failed",
        amountPaise: 100_000n,
        errorReason: "card declined by issuer",
      },
    });

    const [opp] = await findOpportunities(merchant.id, { now: NOW });
    expect(opp).toBeDefined();
    expect(opp?.leakId).toBe(leak.id);
    expect(opp?.diagnosisClass).toBe("METHOD_DECLINED");
    expect(opp?.verdict).toBe("would_dispatch");
    expect(opp?.evPaise).toBeGreaterThan(0n);
  });

  it("skips a leak that already has a RecoveryAction — it isn't unaddressed anymore", async () => {
    const merchant = await seedMerchant();
    const leak = await prisma.leak.create({
      data: {
        merchantId: merchant.id,
        class: "PAYMENT_BLOCKED",
        amountPaise: 100_000n,
        checkoutId: "c1",
        evidenceEventIds: ["fe1"],
        confidence: 1,
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
        evPaise: 1000n,
        shieldVerdict: "PASS",
      },
    });

    const opportunities = await findOpportunities(merchant.id, { now: NOW });
    expect(opportunities).toHaveLength(0);
  });

  it("ignores SILENT_ABANDON and PRE_CHECKOUT_DROP — Policy has no action mapping for them yet", async () => {
    const merchant = await seedMerchant();
    await prisma.leak.create({
      data: {
        merchantId: merchant.id,
        class: "SILENT_ABANDON",
        amountPaise: 50_000n,
        checkoutId: "c1",
        evidenceEventIds: ["fe1"],
        confidence: 1,
      },
    });
    await prisma.leak.create({
      data: {
        merchantId: merchant.id,
        class: "PRE_CHECKOUT_DROP",
        amountPaise: 50_000n,
        checkoutId: "c2",
        evidenceEventIds: ["fe2"],
        confidence: 1,
      },
    });

    const opportunities = await findOpportunities(merchant.id, { now: NOW });
    expect(opportunities).toHaveLength(0);
  });

  it("reports no_action, with the real floor reason, for a leak too small to be worth contacting", async () => {
    const merchant = await seedMerchant();
    const leak = await prisma.leak.create({
      data: {
        merchantId: merchant.id,
        class: "PAYMENT_BLOCKED",
        amountPaise: 100n,
        checkoutId: "c1",
        evidenceEventIds: ["fe1"],
        confidence: 1,
      },
    });
    await prisma.paymentAttempt.create({
      data: {
        merchantId: merchant.id,
        rzpPaymentId: `pay_${randomUUID()}`,
        rzpOrderId: `order_${randomUUID()}`,
        checkoutId: "c1",
        joinMethod: "notes",
        method: "card",
        status: "failed",
        amountPaise: 100n,
        errorReason: "card declined by issuer",
      },
    });

    const [opp] = await findOpportunities(merchant.id, { now: NOW, evFloorPaise: 5000n });
    expect(opp?.leakId).toBe(leak.id);
    expect(opp?.verdict).toBe("no_action");
    expect(opp?.reason).toMatch(/below floor/);
  });

  it("would_hold_for_approval when EV clears the floor but exceeds the auto-approve threshold", async () => {
    const merchant = await seedMerchant();
    const leak = await prisma.leak.create({
      data: {
        merchantId: merchant.id,
        class: "PAYMENT_BLOCKED",
        amountPaise: 10_000_000n,
        checkoutId: "c1",
        evidenceEventIds: ["fe1"],
        confidence: 1,
      },
    });
    await prisma.paymentAttempt.create({
      data: {
        merchantId: merchant.id,
        rzpPaymentId: `pay_${randomUUID()}`,
        rzpOrderId: `order_${randomUUID()}`,
        checkoutId: "c1",
        joinMethod: "notes",
        method: "card",
        status: "failed",
        amountPaise: 10_000_000n,
        errorReason: "card declined by issuer",
      },
    });

    const [opp] = await findOpportunities(merchant.id, { now: NOW, autoApproveThresholdPaise: 1000n });
    expect(opp?.leakId).toBe(leak.id);
    expect(opp?.verdict).toBe("would_hold_for_approval");
  });

  it("orders opportunities by predicted EV, highest first", async () => {
    const merchant = await seedMerchant();
    const small = await prisma.leak.create({
      data: {
        merchantId: merchant.id,
        class: "PAYMENT_BLOCKED",
        amountPaise: 50_000n,
        checkoutId: "c_small",
        evidenceEventIds: ["fe1"],
        confidence: 1,
      },
    });
    const big = await prisma.leak.create({
      data: {
        merchantId: merchant.id,
        class: "PAYMENT_BLOCKED",
        amountPaise: 500_000n,
        checkoutId: "c_big",
        evidenceEventIds: ["fe2"],
        confidence: 1,
      },
    });
    for (const leak of [small, big]) {
      await prisma.paymentAttempt.create({
        data: {
          merchantId: merchant.id,
          rzpPaymentId: `pay_${randomUUID()}`,
          rzpOrderId: `order_${randomUUID()}`,
          checkoutId: leak.checkoutId!,
          joinMethod: "notes",
          method: "card",
          status: "failed",
          amountPaise: leak.amountPaise,
          errorReason: "card declined by issuer",
        },
      });
    }

    const opportunities = await findOpportunities(merchant.id, { now: NOW });
    expect(opportunities[0]?.leakId).toBe(big.id);
    expect(opportunities[1]?.leakId).toBe(small.id);
  });
});
