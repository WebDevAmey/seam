import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { prisma } from "../../prisma.js";
import { checkLedgerIntegrity, getOpenConversations, getRevenueLeakSummary, getTopOpportunities } from "./tools.js";

async function seedMerchant() {
  return prisma.merchant.create({ data: { name: "Chat Tools Test", email: `${randomUUID()}@example.com` } });
}

describe("chat tools — real data, no model involved", () => {
  it("getRevenueLeakSummary reports real leaked/recovered totals as strings", async () => {
    const merchant = await seedMerchant();
    await prisma.leak.create({
      data: {
        merchantId: merchant.id,
        class: "PAYMENT_BLOCKED",
        amountPaise: 25_000n,
        checkoutId: "c1",
        evidenceEventIds: ["fe1"],
        confidence: 1,
        detectedAt: new Date(),
      },
    });

    const summary = await getRevenueLeakSummary(merchant.id, 14);
    expect(summary.totalLeakedPaise).toBe("25000");
    expect(typeof summary.totalLeakedPaise).toBe("string");
    expect(summary.byLeakClass.find((c) => c.class === "PAYMENT_BLOCKED")?.count).toBe(1);
  });

  it("getTopOpportunities returns real, unaddressed, actionable leaks", async () => {
    const merchant = await seedMerchant();
    await prisma.leak.create({
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

    const opportunities = await getTopOpportunities(merchant.id, 5);
    expect(opportunities).toHaveLength(1);
    expect(opportunities[0]?.leakClass).toBe("PAYMENT_BLOCKED");
    expect(typeof opportunities[0]?.amountPaise).toBe("string");
  });

  it("getOpenConversations returns only OPEN tickets for this merchant", async () => {
    const merchant = await seedMerchant();
    await prisma.ticket.create({
      data: { merchantId: merchant.id, recoveryActionId: "ra1", replyText: "not interested", replyClass: "REFUSE", status: "OPEN" },
    });
    await prisma.ticket.create({
      data: { merchantId: merchant.id, recoveryActionId: "ra2", replyText: "handled", replyClass: "REFUSE", status: "RESOLVED" },
    });

    const conversations = await getOpenConversations(merchant.id);
    expect(conversations).toHaveLength(1);
    expect(conversations[0]?.replyText).toBe("not interested");
  });

  it("checkLedgerIntegrity reports a real, currently-valid chain", async () => {
    const result = await checkLedgerIntegrity();
    expect(result.valid).toBe(true);
  });
});
