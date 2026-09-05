import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { generateToken } from "../auth/jwt.js";
import { prisma } from "../prisma.js";
import { agentsRoutes } from "./routes.js";

async function seedMerchant(name: string) {
  return prisma.merchant.create({ data: { name, email: `${randomUUID()}@example.com` } });
}

async function tokenFor(merchantId: string) {
  return generateToken({ merchantId, email: "route-test@example.com", name: "Route Test" });
}

describe("GET /merchants/:id/agents", () => {
  it("200s for the merchant's own session and returns the full registry with live counts", async () => {
    const merchant = await seedMerchant("Agents Route Test");
    const res = await agentsRoutes.request(`/merchants/${merchant.id}/agents`, {
      headers: { Authorization: `Bearer ${await tokenFor(merchant.id)}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string; activityCount: number }[];
    expect(body.length).toBeGreaterThan(0);
    expect(body.every((a) => typeof a.activityCount === "number")).toBe(true);
  });

  it("401s with no session", async () => {
    const merchant = await seedMerchant("No Session");
    const res = await agentsRoutes.request(`/merchants/${merchant.id}/agents`);
    expect(res.status).toBe(401);
  });

  it("403s for a different merchant's session", async () => {
    const merchant = await seedMerchant("Target Merchant");
    const attacker = await seedMerchant("Attacker Merchant");
    const res = await agentsRoutes.request(`/merchants/${merchant.id}/agents`, {
      headers: { Authorization: `Bearer ${await tokenFor(attacker.id)}` },
    });
    expect(res.status).toBe(403);
  });

  it("reports real per-agent run counts, split into ok vs total — the fleet page's success-rate bar reads this", async () => {
    const merchant = await seedMerchant("Run Counts Route Test");
    await prisma.agentRun.createMany({
      data: [
        { agentId: "detector", merchantId: merchant.id, status: "ok", summary: "found 1", input: {}, durationMs: 10 },
        { agentId: "detector", merchantId: merchant.id, status: "ok", summary: "found 0", input: {}, durationMs: 8 },
        { agentId: "detector", merchantId: merchant.id, status: "error", summary: "", input: {}, error: "boom", durationMs: 5 },
      ],
    });

    const res = await agentsRoutes.request(`/merchants/${merchant.id}/agents`, {
      headers: { Authorization: `Bearer ${await tokenFor(merchant.id)}` },
    });
    const body = (await res.json()) as { id: string; runCount: number; okRunCount: number }[];
    const detector = body.find((a) => a.id === "detector");
    expect(detector?.runCount).toBe(3);
    expect(detector?.okRunCount).toBe(2);

    const untouched = body.find((a) => a.id === "digest");
    expect(untouched?.runCount).toBe(0);
    expect(untouched?.okRunCount).toBe(0);
  });
});

describe("GET /merchants/:id/agents/opportunities", () => {
  it("200s and returns bigint-safe JSON", async () => {
    const merchant = await seedMerchant("Opportunities Route Test");
    await prisma.leak.create({
      data: {
        merchantId: merchant.id,
        class: "PAYMENT_BLOCKED",
        amountPaise: 50_000n,
        checkoutId: "c1",
        evidenceEventIds: ["fe1"],
        confidence: 1,
      },
    });

    const res = await agentsRoutes.request(`/merchants/${merchant.id}/agents/opportunities`, {
      headers: { Authorization: `Bearer ${await tokenFor(merchant.id)}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { amountPaise: string }[];
    expect(body[0]?.amountPaise).toBe("50000");
  });

  it("403s for a different merchant's session", async () => {
    const merchant = await seedMerchant("Target Merchant 2");
    const attacker = await seedMerchant("Attacker Merchant 2");
    const res = await agentsRoutes.request(`/merchants/${merchant.id}/agents/opportunities`, {
      headers: { Authorization: `Bearer ${await tokenFor(attacker.id)}` },
    });
    expect(res.status).toBe(403);
  });
});

describe("POST /merchants/:id/agents/opportunities/run and /agents/detector/run — the harness in action", () => {
  it("running the opportunities agent writes a real AgentRun row, retrievable via the run-history routes", async () => {
    const merchant = await seedMerchant("Harness Route Test");
    const token = await tokenFor(merchant.id);

    const runRes = await agentsRoutes.request(`/merchants/${merchant.id}/agents/opportunities/run`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(runRes.status).toBe(200);

    const listRes = await agentsRoutes.request(`/merchants/${merchant.id}/agents/opportunities/runs`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(listRes.status).toBe(200);
    const runs = (await listRes.json()) as { id: string; status: string; summary: string }[];
    expect(runs).toHaveLength(1);
    expect(runs[0]?.status).toBe("ok");

    const detailRes = await agentsRoutes.request(`/merchants/${merchant.id}/agents/opportunities/runs/${runs[0]?.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(detailRes.status).toBe(200);
    const detail = (await detailRes.json()) as { output: unknown; input: unknown };
    expect(Array.isArray(detail.output)).toBe(true);
  });

  it("running the detector agent finds real leaks from generated data and logs it", async () => {
    const merchant = await seedMerchant("Detector Route Test");
    await prisma.funnelEvent.create({
      data: {
        merchantId: merchant.id,
        checkoutId: "c1",
        customerRef: "cust1",
        stage: "checkout_start",
        occurredAt: new Date("2026-09-04T10:00:00Z"),
        amountPaise: 50_000n,
        rawEventId: `re_${randomUUID()}`,
      },
    });

    const res = await agentsRoutes.request(`/merchants/${merchant.id}/agents/detector/run`, {
      method: "POST",
      headers: { Authorization: `Bearer ${await tokenFor(merchant.id)}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { created: number };
    expect(typeof body.created).toBe("number");

    const run = await prisma.agentRun.findFirst({ where: { merchantId: merchant.id, agentId: "detector" } });
    expect(run?.status).toBe("ok");
  });

  it("run history 403s for a different merchant's session", async () => {
    const merchant = await seedMerchant("Target Merchant 3");
    const attacker = await seedMerchant("Attacker Merchant 3");
    const res = await agentsRoutes.request(`/merchants/${merchant.id}/agents/opportunities/runs`, {
      headers: { Authorization: `Bearer ${await tokenFor(attacker.id)}` },
    });
    expect(res.status).toBe(403);
  });
});

describe("POST /merchants/:id/agents/{diagnosis,recovery,shield}/run — the previously-untriggerable agents", () => {
  it("running the diagnosis agent writes a real AgentRun row and returns real counts", async () => {
    const merchant = await seedMerchant("Diagnosis Route Test");
    const res = await agentsRoutes.request(`/merchants/${merchant.id}/agents/diagnosis/run`, {
      method: "POST",
      headers: { Authorization: `Bearer ${await tokenFor(merchant.id)}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { processed: number; bySource: { rules: number; llm: number } };
    expect(body).toEqual({ processed: 0, bySource: { rules: 0, llm: 0 } });

    const run = await prisma.agentRun.findFirst({ where: { merchantId: merchant.id, agentId: "diagnosis" } });
    expect(run?.status).toBe("ok");
  });

  it("running the recovery executor writes a real AgentRun row and returns real counts", async () => {
    const merchant = await seedMerchant("Recovery Route Test");
    const res = await agentsRoutes.request(`/merchants/${merchant.id}/agents/recovery/run`, {
      method: "POST",
      headers: { Authorization: `Bearer ${await tokenFor(merchant.id)}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { reserved: number; blocked: number; noAction: number };
    expect(body).toEqual({ reserved: 0, blocked: 0, noAction: 0 });

    const run = await prisma.agentRun.findFirst({ where: { merchantId: merchant.id, agentId: "recovery" } });
    expect(run?.status).toBe("ok");
  });

  it("running the shield recheck writes a real AgentRun row and returns real counts", async () => {
    const merchant = await seedMerchant("Shield Route Test");
    const res = await agentsRoutes.request(`/merchants/${merchant.id}/agents/shield/run`, {
      method: "POST",
      headers: { Authorization: `Bearer ${await tokenFor(merchant.id)}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { checked: number; stillPass: number; nowBlocked: number };
    expect(body).toEqual({ checked: 0, stillPass: 0, nowBlocked: 0 });

    const run = await prisma.agentRun.findFirst({ where: { merchantId: merchant.id, agentId: "shield" } });
    expect(run?.status).toBe("ok");
  });

  it("401s each new route with no session", async () => {
    const merchant = await seedMerchant("No Session New Routes");
    for (const agentId of ["diagnosis", "recovery", "shield"]) {
      const res = await agentsRoutes.request(`/merchants/${merchant.id}/agents/${agentId}/run`, { method: "POST" });
      expect(res.status).toBe(401);
    }
  });
});
