import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { prisma } from "../prisma.js";
import { recordAgentRun } from "./harness.js";

async function seedMerchant() {
  return prisma.merchant.create({ data: { name: "Harness Test", email: `${randomUUID()}@example.com` } });
}

describe("recordAgentRun — the harness every agent invocation goes through", () => {
  it("records a successful run with its real output and a durationMs", async () => {
    const merchant = await seedMerchant();

    const result = await recordAgentRun(
      "opportunities",
      merchant.id,
      { days: 7 },
      async () => ({ output: { found: 3 }, summary: "found 3 opportunities" }),
    );

    expect(result).toEqual({ found: 3 });

    const run = await prisma.agentRun.findFirst({ where: { merchantId: merchant.id, agentId: "opportunities" } });
    expect(run?.status).toBe("ok");
    expect(run?.summary).toBe("found 3 opportunities");
    expect(run?.output).toEqual({ found: 3 });
    expect(run?.input).toEqual({ days: 7 });
    expect(run?.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("records a failed run with the real error message, and still re-throws", async () => {
    const merchant = await seedMerchant();

    await expect(
      recordAgentRun("digest", merchant.id, {}, async () => {
        throw new Error("generateDigest blew up");
      }),
    ).rejects.toThrow("generateDigest blew up");

    const run = await prisma.agentRun.findFirst({ where: { merchantId: merchant.id, agentId: "digest" } });
    expect(run?.status).toBe("error");
    expect(run?.error).toBe("generateDigest blew up");
    expect(run?.output).toBeNull();
  });

  it("keeps a real, queryable history across multiple runs of the same agent", async () => {
    const merchant = await seedMerchant();

    await recordAgentRun("digest", merchant.id, { n: 1 }, async () => ({ output: { n: 1 }, summary: "run 1" }));
    await recordAgentRun("digest", merchant.id, { n: 2 }, async () => ({ output: { n: 2 }, summary: "run 2" }));

    const runs = await prisma.agentRun.findMany({
      where: { merchantId: merchant.id, agentId: "digest" },
      orderBy: { startedAt: "asc" },
    });
    expect(runs).toHaveLength(2);
    expect(runs[0]?.summary).toBe("run 1");
    expect(runs[1]?.summary).toBe("run 2");
  });
});
