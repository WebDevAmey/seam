import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../prisma.js";
import { SimulatedSmsAdapter } from "./channel-adapter.js";
import { executeAction, type ExecuteInput } from "./execute-action.js";
import { verifyLedgerChain } from "../ledger/verify.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

async function seedMerchant() {
  return prisma.merchant.create({
    data: { name: "Execute Test", email: `${randomUUID()}@example.com` },
  });
}

function mockRazorpaySuccess() {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: `plink_${randomUUID()}`, short_url: `https://rzp.io/l/${randomUUID()}` }),
    }),
  );
}

function baseInput(overrides: Partial<ExecuteInput> = {}): ExecuteInput {
  return {
    merchantId: "placeholder",
    checkoutId: `checkout_${randomUUID()}`,
    leakId: "leak_1",
    actionClass: "ALTERNATE_METHOD_LINK",
    evPaise: 5000n,
    amountPaise: 100_000n,
    channel: "sms",
    customerPhone: "+919876543210",
    razorpayKeyId: "rzp_test_id",
    razorpayKeySecret: "rzp_test_secret",
    adapter: new SimulatedSmsAdapter(),
    shieldContext: {
      now: new Date("2026-09-04T12:00:00Z"), // clear of quiet hours
      contactsInLast7Days: 0,
      merchantContactsToday: 0,
      merchantDailyOutreachCap: 100,
      autoApproveThresholdPaise: 20_000n,
    },
    ...overrides,
  };
}

describe("executeAction — the full path, PASS verdict", () => {
  it("reserves, creates a real payment link, dispatches, records DISPATCHED, and writes the ledger", async () => {
    const merchant = await seedMerchant();
    mockRazorpaySuccess();

    const result = await executeAction(baseInput({ merchantId: merchant.id }));

    expect(result.outcome).toBe("dispatched");
    if (result.outcome !== "dispatched") throw new Error("unreachable");

    const action = await prisma.recoveryAction.findUnique({ where: { id: result.actionId } });
    expect(action?.state).toBe("DISPATCHED");
    expect(action?.rzpRef).toBeTruthy();
    expect(action?.dispatchedAt).toBeTruthy();

    const chain = await verifyLedgerChain();
    expect(chain.valid).toBe(true);
    const entry = await prisma.ledgerEntry.findFirst({
      where: { merchantId: merchant.id },
      orderBy: { seq: "desc" },
    });
    expect((entry?.payload as { type: string }).type).toBe("action_dispatched");
  });
});

describe("executeAction — Shield blocks before any reservation or dispatch happens", () => {
  it("an opted-out customer: no RecoveryAction row, no payment link call, ledger records the block", async () => {
    const merchant = await seedMerchant();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const customerPhone = "+919876543210"; // matches baseInput()'s default customerPhone
    await prisma.optOut.create({ data: { merchantId: merchant.id, phone: customerPhone } });

    const result = await executeAction(baseInput({ merchantId: merchant.id, customerPhone }));

    expect(result.outcome).toBe("blocked");
    expect(fetchMock).not.toHaveBeenCalled();
    const count = await prisma.recoveryAction.count({ where: { merchantId: merchant.id } });
    expect(count).toBe(0);

    const entry = await prisma.ledgerEntry.findFirst({
      where: { merchantId: merchant.id },
      orderBy: { seq: "desc" },
    });
    expect((entry?.payload as { type: string }).type).toBe("action_blocked");
  });
});

describe("executeAction — idempotency", () => {
  it("a second concurrent call for the same checkout+actionClass gets already_reserved, no double dispatch", async () => {
    const merchant = await seedMerchant();
    mockRazorpaySuccess();
    const input = baseInput({ merchantId: merchant.id });

    const [first, second] = await Promise.all([executeAction(input), executeAction(input)]);
    const outcomes = [first.outcome, second.outcome].sort();

    expect(outcomes).toEqual(["already_reserved", "dispatched"]);
    const count = await prisma.recoveryAction.count({
      where: { merchantId: merchant.id, checkoutId: input.checkoutId, actionClass: input.actionClass },
    });
    expect(count).toBe(1);
  });
});

describe("executeAction — needs approval", () => {
  it("high EV clears the auto-approve threshold: reserved, but not dispatched, ledger records it", async () => {
    const merchant = await seedMerchant();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await executeAction(
      baseInput({
        merchantId: merchant.id,
        evPaise: 50_000n,
        shieldContext: { ...baseInput().shieldContext, autoApproveThresholdPaise: 20_000n },
      }),
    );

    expect(result.outcome).toBe("needs_approval");
    expect(fetchMock).not.toHaveBeenCalled();
    if (result.outcome === "needs_approval") {
      const action = await prisma.recoveryAction.findUnique({ where: { id: result.actionId } });
      expect(action?.state).toBe("RESERVED");
    }
  });
});

describe("executeAction — HOLD_AND_ESCALATE", () => {
  it("never touches Shield, the adapter, or Razorpay — just reserves and logs", async () => {
    const merchant = await seedMerchant();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await executeAction(baseInput({ merchantId: merchant.id, actionClass: "HOLD_AND_ESCALATE" }));

    expect(result.outcome).toBe("dispatched");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("executeAction — a real dispatch failure releases the lock instead of wedging it", () => {
  it("Razorpay rejecting the link creation moves the reservation to FAILED and re-throws", async () => {
    const merchant = await seedMerchant();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    const input = baseInput({ merchantId: merchant.id });
    await expect(executeAction(input)).rejects.toThrow();

    const action = await prisma.recoveryAction.findFirst({
      where: { merchantId: merchant.id, checkoutId: input.checkoutId },
    });
    expect(action?.state).toBe("FAILED");

    // and a fresh attempt afterwards is allowed to reserve again
    mockRazorpaySuccess();
    const retry = await executeAction(input);
    expect(retry.outcome).toBe("dispatched");
  });
});
