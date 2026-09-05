import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { prisma } from "../prisma.js";
import { generateDigest } from "./generate-digest.js";

describe("generateDigest — against real Leak/RecoveryAction rows", () => {
  it("aggregates leaks and actions within the period, ignores rows outside it", async () => {
    const merchant = await prisma.merchant.create({
      data: { name: "Digest Test", email: `${randomUUID()}@example.com` },
    });

    const periodStart = new Date("2026-08-28T00:00:00Z");
    const periodEnd = new Date("2026-09-04T00:00:00Z");

    // inside the period
    const leak = await prisma.leak.create({
      data: {
        merchantId: merchant.id,
        class: "PAYMENT_BLOCKED",
        amountPaise: 50_000n,
        checkoutId: "checkout_1",
        evidenceEventIds: ["fe_1"],
        confidence: 1,
        detectedAt: new Date("2026-09-01T00:00:00Z"),
      },
    });
    await prisma.recoveryAction.create({
      data: {
        merchantId: merchant.id,
        checkoutId: "checkout_1",
        leakId: leak.id,
        actionClass: "ALTERNATE_METHOD_LINK",
        state: "DISPATCHED",
        idempotencyKey: "k1",
        evPaise: 12_000n,
        shieldVerdict: "PASS",
        createdAt: new Date("2026-09-01T00:00:00Z"),
      },
    });
    await prisma.recoveryAction.create({
      data: {
        merchantId: merchant.id,
        checkoutId: "checkout_2",
        leakId: leak.id,
        actionClass: "ALTERNATE_METHOD_LINK",
        state: "FAILED",
        idempotencyKey: "k2",
        evPaise: 500n,
        shieldVerdict: "BLOCK",
        shieldReason: "amount below the ₹200 recovery floor",
        createdAt: new Date("2026-09-02T00:00:00Z"),
      },
    });

    // outside the period — must not be counted
    await prisma.leak.create({
      data: {
        merchantId: merchant.id,
        class: "SILENT_ABANDON",
        amountPaise: 999_999n,
        checkoutId: "checkout_old",
        evidenceEventIds: ["fe_old"],
        confidence: 1,
        detectedAt: new Date("2026-08-01T00:00:00Z"),
      },
    });

    const digest = await generateDigest(merchant.id, periodStart, periodEnd);

    expect(digest.leaksDetected).toBe(1);
    expect(digest.totalLeakAmountPaise).toBe(50_000n);
    expect(digest.actionsDispatched).toBe(1);
    expect(digest.actionsBlocked).toBe(1);
    expect(digest.netRecoveredPaise).toBe(12_000n);
    expect(digest.shieldBlockReasons).toEqual([{ reason: "amount below the ₹200 recovery floor", count: 1 }]);
    expect(digest.narrative).toContain("1 leak");
    expect(digest.narrative).not.toContain("1 leaks");
  });

  it("produces a clean zero-state digest for a merchant with no activity", async () => {
    const merchant = await prisma.merchant.create({
      data: { name: "Digest Test Empty", email: `${randomUUID()}@example.com` },
    });
    const digest = await generateDigest(merchant.id, new Date("2026-08-28"), new Date("2026-09-04"));
    expect(digest.leaksDetected).toBe(0);
    expect(digest.narrative).toContain("No leaks");
  });
});
