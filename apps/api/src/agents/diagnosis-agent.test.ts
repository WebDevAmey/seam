import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { prisma } from "../prisma.js";
import { runDiagnosisAgent } from "./diagnosis-agent.js";

async function seedMerchant() {
  return prisma.merchant.create({ data: { name: "Diagnosis Agent Test", email: `${randomUUID()}@example.com` } });
}

describe("runDiagnosisAgent — persists a real Diagnosis row per undiagnosed leak", () => {
  it("classifies a clean decline reason by rules alone, never calling the injected classifier", async () => {
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
        errorReason: "insufficient funds in account",
      },
    });

    let called = 0;
    const result = await runDiagnosisAgent(merchant.id, async () => {
      called++;
      throw new Error("should never be called for a rules-resolvable leak");
    });

    expect(result).toEqual({ processed: 1, bySource: { rules: 1, llm: 0 } });
    expect(called).toBe(0);

    const row = await prisma.diagnosis.findFirst({ where: { leakId: leak.id } });
    expect(row?.diagnosisClass).toBe("INSUFFICIENT_FUNDS");
    expect(row?.source).toBe("rules");
  });

  it("diagnoses ISSUER_DOWNTIME leaks by rules, with no PaymentAttempt required", async () => {
    const merchant = await seedMerchant();
    const leak = await prisma.leak.create({
      data: { merchantId: merchant.id, class: "ISSUER_DOWNTIME", amountPaise: 50_000n, checkoutId: "c2", evidenceEventIds: ["fe2"], confidence: 1 },
    });

    const result = await runDiagnosisAgent(merchant.id, async () => {
      throw new Error("should never be called");
    });

    expect(result.bySource.rules).toBe(1);
    const row = await prisma.diagnosis.findFirst({ where: { leakId: leak.id } });
    expect(row?.diagnosisClass).toBe("ISSUER_DOWNTIME");
  });

  it("escalates an unmatched decline reason to the injected classifier and records it as an llm-sourced diagnosis", async () => {
    const merchant = await seedMerchant();
    const leak = await prisma.leak.create({
      data: { merchantId: merchant.id, class: "PAYMENT_BLOCKED", amountPaise: 80_000n, checkoutId: "c3", evidenceEventIds: ["fe3"], confidence: 1 },
    });
    await prisma.paymentAttempt.create({
      data: {
        merchantId: merchant.id,
        rzpPaymentId: `pay_${randomUUID()}`,
        rzpOrderId: `order_${randomUUID()}`,
        checkoutId: "c3",
        joinMethod: "notes",
        method: "upi",
        status: "failed",
        amountPaise: 80_000n,
        errorReason: "issuer_unresponsive_generic",
      },
    });

    const result = await runDiagnosisAgent(merchant.id, async () => ({
      diagnosisClass: "AUTH_FAILED",
      reasoning: "the issuer's own response indicates an authentication step failed",
      evidenceEventIds: ["fe3"],
    }));

    expect(result).toEqual({ processed: 1, bySource: { rules: 0, llm: 1 } });
    const row = await prisma.diagnosis.findFirst({ where: { leakId: leak.id } });
    expect(row?.diagnosisClass).toBe("AUTH_FAILED");
    expect(row?.source).toBe("llm");
  });

  it("falls back to a rules UNKNOWN_TRANSIENT diagnosis when the classifier throws", async () => {
    const merchant = await seedMerchant();
    const leak = await prisma.leak.create({
      data: { merchantId: merchant.id, class: "PAYMENT_BLOCKED", amountPaise: 60_000n, checkoutId: "c4", evidenceEventIds: ["fe4"], confidence: 1 },
    });
    await prisma.paymentAttempt.create({
      data: {
        merchantId: merchant.id,
        rzpPaymentId: `pay_${randomUUID()}`,
        rzpOrderId: `order_${randomUUID()}`,
        checkoutId: "c4",
        joinMethod: "notes",
        method: "netbanking",
        status: "failed",
        amountPaise: 60_000n,
        errorReason: "totally_unrecognised_reason",
      },
    });

    const result = await runDiagnosisAgent(merchant.id, async () => {
      throw new Error("network error");
    });

    expect(result.bySource.rules).toBe(1);
    const row = await prisma.diagnosis.findFirst({ where: { leakId: leak.id } });
    expect(row?.diagnosisClass).toBe("UNKNOWN_TRANSIENT");
    expect(row?.source).toBe("rules");
  });

  it("skips a leak that already has a Diagnosis row", async () => {
    const merchant = await seedMerchant();
    const leak = await prisma.leak.create({
      data: { merchantId: merchant.id, class: "PAYMENT_BLOCKED", amountPaise: 100_000n, checkoutId: "c5", evidenceEventIds: ["fe5"], confidence: 1 },
    });
    await prisma.diagnosis.create({
      data: { leakId: leak.id, diagnosisClass: "METHOD_DECLINED", confidence: 0.95, source: "rules", evidenceEventIds: ["fe5"], latencyMs: 1 },
    });

    const result = await runDiagnosisAgent(merchant.id, async () => {
      throw new Error("should never be called");
    });

    expect(result).toEqual({ processed: 0, bySource: { rules: 0, llm: 0 } });
  });
});
