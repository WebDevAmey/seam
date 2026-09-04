import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { prisma } from "../prisma.js";
import { reserveAction, type ReserveInput } from "./reserve-action.js";

async function seedMerchant() {
  return prisma.merchant.create({
    data: { name: "Reserve Test", email: `${randomUUID()}@example.com` },
  });
}

function reservation(overrides: Partial<ReserveInput>): ReserveInput {
  return {
    merchantId: "placeholder",
    checkoutId: "checkout_1",
    leakId: "leak_1",
    actionClass: "ALTERNATE_METHOD_LINK",
    evPaise: 5000n,
    shieldVerdict: "PASS",
    ...overrides,
  };
}

describe("reserveAction — the reservation IS the lock (PRD §9, §13 invariant 1)", () => {
  it("succeeds once for a fresh (merchant, checkout, actionClass)", async () => {
    const merchant = await seedMerchant();
    const result = await reserveAction(reservation({ merchantId: merchant.id }));
    expect(result.reserved).toBe(true);
  });

  it("10 identical concurrent reservations — exactly one wins, nine come back reserved:false, not errors", async () => {
    const merchant = await seedMerchant();
    const input = reservation({ merchantId: merchant.id, checkoutId: `checkout_${randomUUID()}` });

    const results = await Promise.all(Array.from({ length: 10 }, () => reserveAction(input)));

    const wins = results.filter((r) => r.reserved);
    const losses = results.filter((r) => !r.reserved);
    expect(wins).toHaveLength(1);
    expect(losses).toHaveLength(9);

    const rows = await prisma.recoveryAction.count({
      where: { merchantId: merchant.id, checkoutId: input.checkoutId, actionClass: input.actionClass },
    });
    expect(rows).toBe(1);
  });

  it("a different actionClass on the same checkout gets its own reservation", async () => {
    const merchant = await seedMerchant();
    const checkoutId = `checkout_${randomUUID()}`;
    const first = await reserveAction(reservation({ merchantId: merchant.id, checkoutId, actionClass: "SAME_METHOD_LINK" }));
    const second = await reserveAction(
      reservation({ merchantId: merchant.id, checkoutId, actionClass: "ALTERNATE_METHOD_LINK" }),
    );
    expect(first.reserved).toBe(true);
    expect(second.reserved).toBe(true);
  });

  it("a FAILED prior attempt doesn't block a fresh reservation — the whole point of not using a flat UNIQUE", async () => {
    const merchant = await seedMerchant();
    const checkoutId = `checkout_${randomUUID()}`;
    const input = reservation({ merchantId: merchant.id, checkoutId });

    const first = await reserveAction(input);
    expect(first.reserved).toBe(true);
    if (!first.reserved) throw new Error("unreachable");

    await prisma.recoveryAction.update({ where: { id: first.actionId }, data: { state: "FAILED" } });

    const retry = await reserveAction(input);
    expect(retry.reserved).toBe(true);
  });

  it("a DISPATCHED prior attempt still blocks a duplicate reservation", async () => {
    const merchant = await seedMerchant();
    const checkoutId = `checkout_${randomUUID()}`;
    const input = reservation({ merchantId: merchant.id, checkoutId });

    const first = await reserveAction(input);
    if (!first.reserved) throw new Error("unreachable");
    await prisma.recoveryAction.update({ where: { id: first.actionId }, data: { state: "DISPATCHED" } });

    const duplicate = await reserveAction(input);
    expect(duplicate.reserved).toBe(false);
  });
});
