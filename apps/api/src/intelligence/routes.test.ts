import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { generateToken } from "../auth/jwt.js";
import { prisma } from "../prisma.js";
import { intelligenceRoutes } from "./routes.js";

async function seedMerchant(name: string) {
  return prisma.merchant.create({ data: { name, email: `${randomUUID()}@example.com` } });
}

async function tokenFor(merchantId: string) {
  return generateToken({ merchantId, email: "route-test@example.com", name: "Route Test" });
}

describe("POST /merchants/:id/intelligence/analyze — auth", () => {
  it("200s for the merchant's own session", async () => {
    const merchant = await seedMerchant("Intelligence Route Test");
    const token = await tokenFor(merchant.id);
    const res = await intelligenceRoutes.request(`/merchants/${merchant.id}/intelligence/analyze`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
  });

  it("401s with no session", async () => {
    const merchant = await seedMerchant("No Session");
    const res = await intelligenceRoutes.request(`/merchants/${merchant.id}/intelligence/analyze`, {
      method: "POST",
    });
    expect(res.status).toBe(401);
  });

  it("403s for a different merchant's session — can't trigger a scan against someone else's data", async () => {
    const merchant = await seedMerchant("Target Merchant");
    const attacker = await seedMerchant("Attacker Merchant");
    const res = await intelligenceRoutes.request(`/merchants/${merchant.id}/intelligence/analyze`, {
      method: "POST",
      headers: { Authorization: `Bearer ${await tokenFor(attacker.id)}` },
    });
    expect(res.status).toBe(403);
  });
});
