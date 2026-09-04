import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { prisma } from "../prisma.js";
import { recoveryActionRoutes } from "./routes.js";

describe("GET /merchants/:id/recovery-actions", () => {
  it("returns this merchant's actions, newest first, blocked reasons included", async () => {
    const merchant = await prisma.merchant.create({
      data: { name: "Actions Route Test", email: `${randomUUID()}@example.com` },
    });

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

    const res = await recoveryActionRoutes.request(`/merchants/${merchant.id}/recovery-actions`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { evPaise: string; shieldReason: string | null }[];

    expect(body).toHaveLength(1);
    expect(body[0]?.evPaise).toBe("5000");
    expect(body[0]?.shieldReason).toBe("EV above the auto-approve threshold");
  });
});
