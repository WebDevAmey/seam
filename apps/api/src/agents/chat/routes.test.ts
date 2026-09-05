import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { generateToken } from "../../auth/jwt.js";
import { prisma } from "../../prisma.js";
import { chatRoutes } from "./routes.js";

async function seedMerchant(name: string) {
  return prisma.merchant.create({ data: { name, email: `${randomUUID()}@example.com` } });
}

async function tokenFor(merchantId: string) {
  return generateToken({ merchantId, email: "route-test@example.com", name: "Route Test" });
}

describe("POST /merchants/:id/chat — auth", () => {
  it("401s with no session", async () => {
    const merchant = await seedMerchant("No Session");
    const res = await chatRoutes.request(`/merchants/${merchant.id}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "hi" }),
    });
    expect(res.status).toBe(401);
  });

  it("403s for a different merchant's session", async () => {
    const merchant = await seedMerchant("Target Merchant");
    const attacker = await seedMerchant("Attacker Merchant");
    const res = await chatRoutes.request(`/merchants/${merchant.id}/chat`, {
      method: "POST",
      headers: { Authorization: `Bearer ${await tokenFor(attacker.id)}`, "Content-Type": "application/json" },
      body: JSON.stringify({ message: "hi" }),
    });
    expect(res.status).toBe(403);
  });

  it("400s for an empty message", async () => {
    const merchant = await seedMerchant("Bad Input Test");
    const res = await chatRoutes.request(`/merchants/${merchant.id}/chat`, {
      method: "POST",
      headers: { Authorization: `Bearer ${await tokenFor(merchant.id)}`, "Content-Type": "application/json" },
      body: JSON.stringify({ message: "" }),
    });
    expect(res.status).toBe(400);
  });
});

describe("GET /merchants/:id/chat/threads — auth", () => {
  it("200s for the merchant's own session", async () => {
    const merchant = await seedMerchant("Threads Route Test");
    const res = await chatRoutes.request(`/merchants/${merchant.id}/chat/threads`, {
      headers: { Authorization: `Bearer ${await tokenFor(merchant.id)}` },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("403s for a different merchant's session", async () => {
    const merchant = await seedMerchant("Target Merchant 2");
    const attacker = await seedMerchant("Attacker Merchant 2");
    const res = await chatRoutes.request(`/merchants/${merchant.id}/chat/threads`, {
      headers: { Authorization: `Bearer ${await tokenFor(attacker.id)}` },
    });
    expect(res.status).toBe(403);
  });
});

describe("GET /merchants/:id/chat/threads/:threadId — scoping", () => {
  it("404s for a thread that belongs to a different merchant", async () => {
    const merchant = await seedMerchant("Target Merchant 3");
    const other = await seedMerchant("Other Merchant 3");
    const thread = await prisma.chatThread.create({ data: { merchantId: other.id } });

    const res = await chatRoutes.request(`/merchants/${merchant.id}/chat/threads/${thread.id}`, {
      headers: { Authorization: `Bearer ${await tokenFor(merchant.id)}` },
    });
    expect(res.status).toBe(404);
  });
});
