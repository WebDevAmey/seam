import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { generateToken } from "../auth/jwt.js";
import { prisma } from "../prisma.js";
import { leakRoutes } from "./routes.js";

async function seedMerchant(name: string) {
  return prisma.merchant.create({ data: { name, email: `${randomUUID()}@example.com` } });
}

async function tokenFor(merchantId: string) {
  return generateToken({ merchantId, email: "route-test@example.com", name: "Route Test" });
}

describe("GET /merchants/:id/leaks", () => {
  it("returns this merchant's leaks only, bigints as strings, newest first", async () => {
    const merchant = await seedMerchant("Leak Routes Test");
    const otherMerchant = await seedMerchant("Other Merchant");

    await prisma.leak.create({
      data: {
        merchantId: otherMerchant.id,
        class: "PAYMENT_BLOCKED",
        amountPaise: 999n,
        checkoutId: "checkout_other",
        evidenceEventIds: ["fe_x"],
        confidence: 1,
      },
    });
    const mine = await prisma.leak.create({
      data: {
        merchantId: merchant.id,
        class: "SILENT_ABANDON",
        amountPaise: 150_000n,
        checkoutId: "checkout_mine",
        evidenceEventIds: ["fe_1"],
        confidence: 1,
      },
    });

    const token = await tokenFor(merchant.id);
    const res = await leakRoutes.request(`/merchants/${merchant.id}/leaks`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string; amountPaise: string; class: string }[];

    expect(body).toHaveLength(1);
    expect(body[0]?.id).toBe(mine.id);
    expect(body[0]?.amountPaise).toBe("150000");
    expect(body[0]?.class).toBe("SILENT_ABANDON");
  });

  it("returns an empty array, not an error, for a merchant with no leaks", async () => {
    const merchant = await seedMerchant("No Leaks");
    const token = await tokenFor(merchant.id);
    const res = await leakRoutes.request(`/merchants/${merchant.id}/leaks`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("401s with no session at all — this used to trust the URL's merchantId with no check", async () => {
    const merchant = await seedMerchant("No Session");
    const res = await leakRoutes.request(`/merchants/${merchant.id}/leaks`);
    expect(res.status).toBe(401);
  });

  it("403s when a valid session for one merchant requests another merchant's leaks", async () => {
    const merchant = await seedMerchant("Target Merchant");
    const attacker = await seedMerchant("Attacker Merchant");
    const attackerToken = await tokenFor(attacker.id);

    const res = await leakRoutes.request(`/merchants/${merchant.id}/leaks`, {
      headers: { Authorization: `Bearer ${attackerToken}` },
    });
    expect(res.status).toBe(403);
  });
});
