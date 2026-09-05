import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { generateToken } from "../auth/jwt.js";
import { prisma } from "../prisma.js";
import { recoveryActionRoutes } from "./routes.js";

async function seedMerchant(name: string) {
  return prisma.merchant.create({ data: { name, email: `${randomUUID()}@example.com` } });
}

async function tokenFor(merchantId: string) {
  return generateToken({ merchantId, email: "route-test@example.com", name: "Route Test" });
}

async function seedReservedAction(merchantId: string) {
  const leak = await prisma.leak.create({
    data: {
      merchantId,
      class: "PAYMENT_BLOCKED",
      amountPaise: 50_000n,
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
      state: "RESERVED",
      idempotencyKey: `${merchantId}:${leak.checkoutId}:route-test`,
      evPaise: 5000n,
      shieldVerdict: "NEEDS_APPROVAL",
      shieldReason: "EV above the auto-approve threshold",
    },
  });
}

describe("GET /merchants/:id/recovery-actions", () => {
  it("returns this merchant's actions, newest first, blocked reasons included", async () => {
    const merchant = await seedMerchant("Actions Route Test");

    await prisma.recoveryAction.create({
      data: {
        merchantId: merchant.id,
        checkoutId: "checkout_1",
        leakId: "leak_1",
        actionClass: "ALTERNATE_METHOD_LINK",
        state: "RESERVED",
        idempotencyKey: "k1",
        evPaise: 5000n,
        shieldVerdict: "NEEDS_APPROVAL",
        shieldReason: "EV above the auto-approve threshold",
      },
    });

    const token = await tokenFor(merchant.id);
    const res = await recoveryActionRoutes.request(`/merchants/${merchant.id}/recovery-actions`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { evPaise: string; shieldReason: string | null }[];

    expect(body).toHaveLength(1);
    expect(body[0]?.evPaise).toBe("5000");
    expect(body[0]?.shieldReason).toBe("EV above the auto-approve threshold");
  });

  it("403s when a valid session for one merchant requests another merchant's recovery actions", async () => {
    const merchant = await seedMerchant("Target Merchant");
    const attacker = await seedMerchant("Attacker Merchant");
    const attackerToken = await tokenFor(attacker.id);

    const res = await recoveryActionRoutes.request(`/merchants/${merchant.id}/recovery-actions`, {
      headers: { Authorization: `Bearer ${attackerToken}` },
    });
    expect(res.status).toBe(403);
  });
});

describe("POST /recovery-actions/:id/reject", () => {
  it("rejects a real pending action for the caller's own merchant", async () => {
    const merchant = await seedMerchant("Reject Route Test");
    const action = await seedReservedAction(merchant.id);

    const res = await recoveryActionRoutes.request(`/recovery-actions/${action.id}/reject`, {
      method: "POST",
      headers: { Authorization: `Bearer ${await tokenFor(merchant.id)}`, "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "too small to bother" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { outcome: string };
    expect(body.outcome).toBe("rejected");
  });

  it("401s with no session", async () => {
    const merchant = await seedMerchant("No Session Reject");
    const action = await seedReservedAction(merchant.id);
    const res = await recoveryActionRoutes.request(`/recovery-actions/${action.id}/reject`, { method: "POST" });
    expect(res.status).toBe(401);
  });

  it("404s trying to reject a different merchant's action", async () => {
    const merchant = await seedMerchant("Owner Merchant");
    const attacker = await seedMerchant("Attacker Merchant 2");
    const action = await seedReservedAction(merchant.id);

    const res = await recoveryActionRoutes.request(`/recovery-actions/${action.id}/reject`, {
      method: "POST",
      headers: { Authorization: `Bearer ${await tokenFor(attacker.id)}` },
    });
    expect(res.status).toBe(404);
  });
});

describe("POST /recovery-actions/:id/approve", () => {
  it("honestly reports not_connected for a merchant with no Razorpay credentials", async () => {
    const merchant = await seedMerchant("Approve Route Test");
    const action = await seedReservedAction(merchant.id);

    const res = await recoveryActionRoutes.request(`/recovery-actions/${action.id}/approve`, {
      method: "POST",
      headers: { Authorization: `Bearer ${await tokenFor(merchant.id)}` },
    });
    expect(res.status).toBe(409);
    const body = (await res.json()) as { outcome: string };
    expect(body.outcome).toBe("not_connected");
  });

  it("401s with no session", async () => {
    const merchant = await seedMerchant("No Session Approve");
    const action = await seedReservedAction(merchant.id);
    const res = await recoveryActionRoutes.request(`/recovery-actions/${action.id}/approve`, { method: "POST" });
    expect(res.status).toBe(401);
  });
});
