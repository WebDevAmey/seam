import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { prisma } from "../prisma.js";
import { runShieldRecheck } from "./shield-recheck.js";

async function seedMerchant() {
  return prisma.merchant.create({ data: { name: "Shield Recheck Test", email: `${randomUUID()}@example.com` } });
}

async function seedReservedAction(merchantId: string, overrides: { evPaise: bigint; leakAmountPaise: bigint; checkoutId: string }) {
  const leak = await prisma.leak.create({
    data: { merchantId, class: "PAYMENT_BLOCKED", amountPaise: overrides.leakAmountPaise, checkoutId: overrides.checkoutId, evidenceEventIds: ["fe1"], confidence: 1 },
  });
  await prisma.recoveryAction.create({
    data: {
      merchantId,
      checkoutId: overrides.checkoutId,
      leakId: leak.id,
      actionClass: "ALTERNATE_METHOD_LINK",
      state: "RESERVED",
      idempotencyKey: `${merchantId}:${overrides.checkoutId}:ALTERNATE_METHOD_LINK`,
      evPaise: overrides.evPaise,
      shieldVerdict: "PASS",
    },
  });
  return leak;
}

const DAY_HOUR_UTC = new Date("2026-09-04T10:00:00Z"); // 15:30 IST — not quiet hours
const NIGHT_HOUR_UTC = new Date("2026-09-04T18:00:00Z"); // 23:30 IST — quiet hours

describe("runShieldRecheck — a scoped recheck of currently-pending actions", () => {
  it("reports a healthy action as still passing during normal hours", async () => {
    const merchant = await seedMerchant();
    await seedReservedAction(merchant.id, { evPaise: 5000n, leakAmountPaise: 100_000n, checkoutId: "c1" });

    const result = await runShieldRecheck(merchant.id, DAY_HOUR_UTC);
    expect(result).toEqual({ checked: 1, stillPass: 1, nowBlocked: 0 });
  });

  it("flags real drift: the same action now falls inside quiet hours", async () => {
    const merchant = await seedMerchant();
    await seedReservedAction(merchant.id, { evPaise: 5000n, leakAmountPaise: 100_000n, checkoutId: "c2" });

    const result = await runShieldRecheck(merchant.id, NIGHT_HOUR_UTC);
    expect(result).toEqual({ checked: 1, stillPass: 0, nowBlocked: 1 });

    // Read-only: a recheck reports drift, it never mutates state on its own.
    const action = await prisma.recoveryAction.findFirst({ where: { merchantId: merchant.id } });
    expect(action?.state).toBe("RESERVED");
  });

  it("flags an action whose leak amount is below the recovery floor", async () => {
    const merchant = await seedMerchant();
    await seedReservedAction(merchant.id, { evPaise: 5000n, leakAmountPaise: 50n, checkoutId: "c3" });

    const result = await runShieldRecheck(merchant.id, DAY_HOUR_UTC);
    expect(result.nowBlocked).toBe(1);
  });

  it("ignores HOLD_AND_ESCALATE actions, which never go through Shield in the first place", async () => {
    const merchant = await seedMerchant();
    const leak = await prisma.leak.create({
      data: { merchantId: merchant.id, class: "PAYMENT_BLOCKED", amountPaise: 100_000n, checkoutId: "c4", evidenceEventIds: ["fe4"], confidence: 1 },
    });
    await prisma.recoveryAction.create({
      data: {
        merchantId: merchant.id,
        checkoutId: "c4",
        leakId: leak.id,
        actionClass: "HOLD_AND_ESCALATE",
        state: "RESERVED",
        idempotencyKey: `${merchant.id}:c4:HOLD_AND_ESCALATE`,
        evPaise: 0n,
        shieldVerdict: "N/A",
      },
    });

    const result = await runShieldRecheck(merchant.id, DAY_HOUR_UTC);
    expect(result).toEqual({ checked: 0, stillPass: 0, nowBlocked: 0 });
  });

  it("does not count another merchant's pending actions", async () => {
    const merchant = await seedMerchant();
    const other = await seedMerchant();
    await seedReservedAction(other.id, { evPaise: 5000n, leakAmountPaise: 100_000n, checkoutId: "c5" });

    const result = await runShieldRecheck(merchant.id, DAY_HOUR_UTC);
    expect(result).toEqual({ checked: 0, stillPass: 0, nowBlocked: 0 });
  });
});
