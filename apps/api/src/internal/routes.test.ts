import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../prisma.js";
import { internalRoutes } from "./routes.js";

const SWEEP_SECRET = "test-sweep-secret";

beforeAll(() => {
  process.env.SWEEP_SECRET = SWEEP_SECRET;
});

describe("POST /internal/sweep", () => {
  it("rejects a request with no shared secret", async () => {
    const res = await internalRoutes.request("/internal/sweep", { method: "POST" });
    expect(res.status).toBe(401);
  });

  it("rejects a request with the wrong secret", async () => {
    const res = await internalRoutes.request("/internal/sweep", {
      method: "POST",
      headers: { "x-sweep-secret": "wrong" },
    });
    expect(res.status).toBe(401);
  });

  it("claims and resolves pending RawEvents when authorised", async () => {
    const merchant = await prisma.merchant.create({
      data: { name: "Sweep Test", email: `${randomUUID()}@example.com` },
    });
    await prisma.rawEvent.create({
      data: {
        merchantId: merchant.id,
        source: "shopify",
        eventType: "checkouts/create",
        externalId: `checkouts/create:${randomUUID()}`,
        payload: {
          id: randomUUID(),
          email: "sweep@example.com",
          total_price: "500.00",
          created_at: new Date().toISOString(),
        },
        signatureVerified: true,
      },
    });

    const res = await internalRoutes.request("/internal/sweep", {
      method: "POST",
      headers: { "x-sweep-secret": SWEEP_SECRET },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { claimed: number };
    expect(body.claimed).toBeGreaterThanOrEqual(1);

    const funnelEvent = await prisma.funnelEvent.findFirst({ where: { merchantId: merchant.id } });
    expect(funnelEvent?.stage).toBe("checkout_start");
  });
});
