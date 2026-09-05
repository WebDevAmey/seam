import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { generateToken } from "../auth/jwt.js";
import { prisma } from "../prisma.js";
import { merchantRoutes } from "./routes.js";

describe("POST /merchants/:id/razorpay/connect — auth", () => {
  it("401s with no session — this route mutates stored credentials, so it must never trust the URL alone", async () => {
    const merchant = await prisma.merchant.create({
      data: { name: "Connect Route Test", email: `${randomUUID()}@example.com` },
    });

    const res = await merchantRoutes.request(`/merchants/${merchant.id}/razorpay/connect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyId: "rzp_test_x", keySecret: "secret", webhookSecret: "whsec" }),
    });
    expect(res.status).toBe(401);
  });

  it("403s for a different merchant's session, before ever calling out to Razorpay", async () => {
    const merchant = await prisma.merchant.create({
      data: { name: "Target Merchant", email: `${randomUUID()}@example.com` },
    });
    const attacker = await prisma.merchant.create({
      data: { name: "Attacker Merchant", email: `${randomUUID()}@example.com` },
    });
    const attackerToken = await generateToken({ merchantId: attacker.id, email: "a@example.com", name: "Attacker" });

    const res = await merchantRoutes.request(`/merchants/${merchant.id}/razorpay/connect`, {
      method: "POST",
      headers: { Authorization: `Bearer ${attackerToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ keyId: "rzp_test_x", keySecret: "secret", webhookSecret: "whsec" }),
    });
    expect(res.status).toBe(403);
  });
});
