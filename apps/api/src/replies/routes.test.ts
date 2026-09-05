import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { generateToken } from "../auth/jwt.js";
import { prisma } from "../prisma.js";
import { repliesRoutes } from "./routes.js";

async function seedMerchant(name: string) {
  return prisma.merchant.create({ data: { name, email: `${randomUUID()}@example.com` } });
}

async function tokenFor(merchantId: string) {
  return generateToken({ merchantId, email: "route-test@example.com", name: "Route Test" });
}

describe("POST /recovery-actions/:id/reply — auth", () => {
  it("201s for a real session and records the reply under the session's own merchant, ignoring any merchantId in the body", async () => {
    const merchant = await seedMerchant("Reply Route Test");
    const spoofTarget = await seedMerchant("Spoof Target");
    const token = await tokenFor(merchant.id);
    const recoveryActionId = `ra_${randomUUID()}`;

    const res = await repliesRoutes.request(`/recovery-actions/${recoveryActionId}/reply`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ merchantId: spoofTarget.id, customerPhone: "+919876543210", text: "not interested" }),
    });
    expect(res.status).toBe(201);

    const ticket = await prisma.ticket.findFirst({ where: { recoveryActionId } });
    expect(ticket?.merchantId).toBe(merchant.id);
    expect(ticket?.merchantId).not.toBe(spoofTarget.id);
  });

  it("401s with no session", async () => {
    const res = await repliesRoutes.request("/recovery-actions/ra_401_test/reply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerPhone: "+919876543210", text: "will pay" }),
    });
    expect(res.status).toBe(401);
  });
});

describe("GET /merchants/:id/tickets — auth", () => {
  it("200s for the merchant's own session", async () => {
    const merchant = await seedMerchant("Tickets Route Test");
    const token = await tokenFor(merchant.id);
    const res = await repliesRoutes.request(`/merchants/${merchant.id}/tickets`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
  });

  it("403s for a different merchant's session", async () => {
    const merchant = await seedMerchant("Target Merchant");
    const attacker = await seedMerchant("Attacker Merchant");
    const res = await repliesRoutes.request(`/merchants/${merchant.id}/tickets`, {
      headers: { Authorization: `Bearer ${await tokenFor(attacker.id)}` },
    });
    expect(res.status).toBe(403);
  });
});
