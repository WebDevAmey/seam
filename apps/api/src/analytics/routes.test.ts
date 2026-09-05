import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { generateToken } from "../auth/jwt.js";
import { prisma } from "../prisma.js";
import { analyticsRoutes } from "./routes.js";

async function seedMerchant(name: string) {
  return prisma.merchant.create({ data: { name, email: `${randomUUID()}@example.com` } });
}

async function tokenFor(merchantId: string) {
  return generateToken({ merchantId, email: "route-test@example.com", name: "Route Test" });
}

describe("GET /merchants/:id/analytics/summary — auth", () => {
  it("200s for the merchant's own session, with a bigint-safe JSON body", async () => {
    const merchant = await seedMerchant("Analytics Route Test");
    const res = await analyticsRoutes.request(`/merchants/${merchant.id}/analytics/summary`, {
      headers: { Authorization: `Bearer ${await tokenFor(merchant.id)}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { dailySeries: { leakAmountPaise: string }[] };
    expect(Array.isArray(body.dailySeries)).toBe(true);
    expect(typeof body.dailySeries[0]?.leakAmountPaise).toBe("string");
  });

  it("401s with no session", async () => {
    const merchant = await seedMerchant("No Session");
    const res = await analyticsRoutes.request(`/merchants/${merchant.id}/analytics/summary`);
    expect(res.status).toBe(401);
  });

  it("403s for a different merchant's session", async () => {
    const merchant = await seedMerchant("Target Merchant");
    const attacker = await seedMerchant("Attacker Merchant");
    const res = await analyticsRoutes.request(`/merchants/${merchant.id}/analytics/summary`, {
      headers: { Authorization: `Bearer ${await tokenFor(attacker.id)}` },
    });
    expect(res.status).toBe(403);
  });
});
