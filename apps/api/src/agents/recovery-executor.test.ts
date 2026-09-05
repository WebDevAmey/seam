import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { prisma } from "../prisma.js";
import { verifyLedgerChain } from "../ledger/verify.js";
import { runRecoveryExecutor } from "./recovery-executor.js";

async function seedMerchant() {
  return prisma.merchant.create({ data: { name: "Recovery Executor Test", email: `${randomUUID()}@example.com` } });
}

const NOW = new Date("2026-09-04T12:00:00Z"); // clear of quiet hours

describe("runRecoveryExecutor — the live orchestration LIMITATIONS.md §10 disclosed as missing", () => {
  it("reserves a real RecoveryAction for a PAYMENT_BLOCKED leak that clears Shield", async () => {
    const merchant = await seedMerchant();
    const leak = await prisma.leak.create({
      data: { merchantId: merchant.id, class: "PAYMENT_BLOCKED", amountPaise: 100_000n, checkoutId: "c1", evidenceEventIds: ["fe1"], confidence: 1 },
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

    const result = await runRecoveryExecutor(merchant.id, { now: NOW });
    expect(result).toEqual({ reserved: 1, blocked: 0, noAction: 0 });

    const action = await prisma.recoveryAction.findFirst({ where: { leakId: leak.id } });
    expect(action?.state).toBe("RESERVED");
    expect(action?.shieldVerdict).toBe("PASS");

    const verified = await verifyLedgerChain();
    expect(verified.valid).toBe(true);
  });

  it("reserves-then-fails a leak Shield blocks, keeping the reason visible", async () => {
    const merchant = await seedMerchant();
    const leak = await prisma.leak.create({
      // Below the ₹200 floor once the recovery-value math runs, well under the EV floor too.
      data: { merchantId: merchant.id, class: "PAYMENT_BLOCKED", amountPaise: 100n, checkoutId: "c2", evidenceEventIds: ["fe2"], confidence: 1 },
    });
    await prisma.paymentAttempt.create({
      data: {
        merchantId: merchant.id,
        rzpPaymentId: `pay_${randomUUID()}`,
        rzpOrderId: `order_${randomUUID()}`,
        checkoutId: "c2",
        joinMethod: "notes",
        method: "card",
        status: "failed",
        amountPaise: 100n,
        errorReason: "card declined by issuer",
      },
    });

    const result = await runRecoveryExecutor(merchant.id, { now: NOW, evFloorPaise: 0n });
    expect(result.blocked).toBe(1);

    const action = await prisma.recoveryAction.findFirst({ where: { leakId: leak.id } });
    expect(action?.state).toBe("FAILED");
    expect(action?.shieldVerdict).toBe("BLOCK");
    expect(action?.shieldReason).toMatch(/floor/i);
  });

  it("reuses a persisted Diagnosis row instead of recomputing it inline", async () => {
    const merchant = await seedMerchant();
    const leak = await prisma.leak.create({
      data: { merchantId: merchant.id, class: "PAYMENT_BLOCKED", amountPaise: 100_000n, checkoutId: "c3", evidenceEventIds: ["fe3"], confidence: 1 },
    });
    // A decline reason that rules would call METHOD_DECLINED, but the
    // persisted Diagnosis says SUSPECTED_FRAUD — proves the executor reads
    // the real row rather than re-deriving its own answer.
    await prisma.paymentAttempt.create({
      data: {
        merchantId: merchant.id,
        rzpPaymentId: `pay_${randomUUID()}`,
        rzpOrderId: `order_${randomUUID()}`,
        checkoutId: "c3",
        joinMethod: "notes",
        method: "card",
        status: "failed",
        amountPaise: 100_000n,
        errorReason: "card declined by issuer",
      },
    });
    await prisma.diagnosis.create({
      data: { leakId: leak.id, diagnosisClass: "SUSPECTED_FRAUD", confidence: 0.9, source: "rules", evidenceEventIds: ["fe3"], latencyMs: 1 },
    });

    await runRecoveryExecutor(merchant.id, { now: NOW });

    const action = await prisma.recoveryAction.findFirst({ where: { leakId: leak.id } });
    expect(action?.actionClass).toBe("HOLD_AND_ESCALATE");
    expect(action?.shieldVerdict).toBe("N/A");
  });

  it("skips a leak that already has a RecoveryAction", async () => {
    const merchant = await seedMerchant();
    const leak = await prisma.leak.create({
      data: { merchantId: merchant.id, class: "PAYMENT_BLOCKED", amountPaise: 100_000n, checkoutId: "c4", evidenceEventIds: ["fe4"], confidence: 1 },
    });
    await prisma.recoveryAction.create({
      data: {
        merchantId: merchant.id,
        checkoutId: "c4",
        leakId: leak.id,
        actionClass: "ALTERNATE_METHOD_LINK",
        state: "DISPATCHED",
        idempotencyKey: `${merchant.id}:c4:ALTERNATE_METHOD_LINK`,
        evPaise: 8000n,
        shieldVerdict: "PASS",
      },
    });

    const result = await runRecoveryExecutor(merchant.id, { now: NOW });
    expect(result).toEqual({ reserved: 0, blocked: 0, noAction: 0 });
  });
});
