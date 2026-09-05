import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { prisma } from "../prisma.js";
import { approveAction, rejectAction } from "./review-action.js";

async function seedMerchant() {
  return prisma.merchant.create({ data: { name: "Review Test", email: `${randomUUID()}@example.com` } });
}

async function seedReservedAction(merchantId: string, overrides: Partial<{ state: string; shieldVerdict: string }> = {}) {
  const leak = await prisma.leak.create({
    data: {
      merchantId,
      class: "PAYMENT_BLOCKED",
      amountPaise: 100_000n,
      checkoutId: `checkout_${randomUUID()}`,
      evidenceEventIds: ["fe1"],
      confidence: 1,
    },
  });
  return prisma.recoveryAction.create({
    data: {
      merchantId,
      checkoutId: leak.checkoutId!,
      leakId: leak.id,
      actionClass: "ALTERNATE_METHOD_LINK",
      state: overrides.state ?? "RESERVED",
      idempotencyKey: `${merchantId}:${leak.checkoutId}:test`,
      evPaise: 9000n,
      shieldVerdict: overrides.shieldVerdict ?? "NEEDS_APPROVAL",
      shieldReason: "EV above the auto-approve threshold",
    },
  });
}

describe("rejectAction — a real, fully working path, no external credentials needed", () => {
  it("marks a RESERVED action FAILED and records why on the ledger", async () => {
    const merchant = await seedMerchant();
    const action = await seedReservedAction(merchant.id);

    const result = await rejectAction(action.id, merchant.id, "not worth contacting this customer");
    expect(result.outcome).toBe("rejected");

    const updated = await prisma.recoveryAction.findUnique({ where: { id: action.id } });
    expect(updated?.state).toBe("FAILED");

    const entry = await prisma.ledgerEntry.findFirst({ where: { merchantId: merchant.id }, orderBy: { seq: "desc" } });
    expect((entry?.payload as { type: string }).type).toBe("action_rejected");
    expect((entry?.payload as { reason: string }).reason).toBe("not worth contacting this customer");
  });

  it("refuses to reject an action that isn't RESERVED", async () => {
    const merchant = await seedMerchant();
    const action = await seedReservedAction(merchant.id, { state: "DISPATCHED" });

    await expect(rejectAction(action.id, merchant.id)).rejects.toThrow(/not pending/i);
  });

  it("refuses to reject an action belonging to a different merchant", async () => {
    const merchant = await seedMerchant();
    const other = await seedMerchant();
    const action = await seedReservedAction(other.id);

    await expect(rejectAction(action.id, merchant.id)).rejects.toThrow(/not found/i);
  });
});

describe("approveAction — a real credential check, honest about what's not connected", () => {
  it("reports not_connected when the merchant has no RazorpayConnection, rather than pretending to dispatch", async () => {
    const merchant = await seedMerchant();
    const action = await seedReservedAction(merchant.id);

    const result = await approveAction(action.id, merchant.id);
    expect(result.outcome).toBe("not_connected");

    // Nothing was silently changed — a real, later approval can still act on it.
    const unchanged = await prisma.recoveryAction.findUnique({ where: { id: action.id } });
    expect(unchanged?.state).toBe("RESERVED");
  });

  it("refuses to approve an action that isn't RESERVED", async () => {
    const merchant = await seedMerchant();
    const action = await seedReservedAction(merchant.id, { state: "FAILED" });

    await expect(approveAction(action.id, merchant.id)).rejects.toThrow(/not pending/i);
  });
});
