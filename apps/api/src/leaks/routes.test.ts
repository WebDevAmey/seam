import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { prisma } from "../prisma.js";
import { leakRoutes } from "./routes.js";

describe("GET /merchants/:id/leaks", () => {
  it("returns this merchant's leaks only, bigints as strings, newest first", async () => {
    const merchant = await prisma.merchant.create({
      data: { name: "Leak Routes Test", email: `${randomUUID()}@example.com` },
    });
    const otherMerchant = await prisma.merchant.create({
      data: { name: "Other Merchant", email: `${randomUUID()}@example.com` },
    });

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

    const res = await leakRoutes.request(`/merchants/${merchant.id}/leaks`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string; amountPaise: string; class: string }[];

    expect(body).toHaveLength(1);
    expect(body[0]?.id).toBe(mine.id);
    expect(body[0]?.amountPaise).toBe("150000");
    expect(body[0]?.class).toBe("SILENT_ABANDON");
  });

  it("returns an empty array, not an error, for a merchant with no leaks", async () => {
    const merchant = await prisma.merchant.create({
      data: { name: "No Leaks", email: `${randomUUID()}@example.com` },
    });
    const res = await leakRoutes.request(`/merchants/${merchant.id}/leaks`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });
});
