import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { prisma } from "../prisma.js";
import { claimUnprocessedRawEvents } from "./claim.js";

describe("claimUnprocessedRawEvents — FOR UPDATE SKIP LOCKED (PRD §6, §13 invariant 1)", () => {
  it("never lets concurrent claimers see the same row, and drops none", async () => {
    const merchant = await prisma.merchant.create({
      data: { name: "Test Merchant", email: `${randomUUID()}@example.com` },
    });

    const rowCount = 12;
    await prisma.rawEvent.createMany({
      data: Array.from({ length: rowCount }, (_, i) => ({
        merchantId: merchant.id,
        source: "razorpay",
        eventType: "payment.failed",
        externalId: `evt-${randomUUID()}-${i}`,
        payload: { i },
        signatureVerified: true,
      })),
    });

    // 6 "workers" racing to claim 2 rows each, at the same instant.
    const claims = await Promise.all(
      Array.from({ length: 6 }, () => claimUnprocessedRawEvents(2)),
    );

    const claimedIds = claims.flat().map((row) => row.id);

    expect(claimedIds).toHaveLength(rowCount); // every row claimed exactly once, none left behind
    expect(new Set(claimedIds).size).toBe(rowCount); // and never claimed twice
  });

  it("skips rows already claimed by a previous call", async () => {
    const merchant = await prisma.merchant.create({
      data: { name: "Test Merchant 2", email: `${randomUUID()}@example.com` },
    });
    await prisma.rawEvent.create({
      data: {
        merchantId: merchant.id,
        source: "razorpay",
        eventType: "payment.failed",
        externalId: `evt-${randomUUID()}`,
        payload: {},
        signatureVerified: true,
      },
    });

    const first = await claimUnprocessedRawEvents(10);
    const second = await claimUnprocessedRawEvents(10);

    expect(first.length).toBeGreaterThan(0);
    expect(second.find((row) => first.some((f) => f.id === row.id))).toBeUndefined();
  });
});
