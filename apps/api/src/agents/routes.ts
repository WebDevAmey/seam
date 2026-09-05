import { Hono } from "hono";
import { requireOwnMerchant, type AuthEnv } from "../auth/middleware.js";
import { detectLeaksForMerchant } from "../leaks/detect-for-merchant.js";
import { prisma } from "../prisma.js";
import { recordAgentRun } from "./harness.js";
import { AGENT_REGISTRY } from "./registry.js";
import { findOpportunities, type Opportunity } from "./opportunities.js";
import { runDiagnosisAgent } from "./diagnosis-agent.js";
import { runRecoveryExecutor } from "./recovery-executor.js";
import { runShieldRecheck } from "./shield-recheck.js";

export const agentsRoutes = new Hono<AuthEnv>();

function serializeOpportunity(o: Opportunity) {
  return { ...o, amountPaise: o.amountPaise.toString(), evPaise: o.evPaise?.toString() ?? null };
}

agentsRoutes.get("/merchants/:id/agents", requireOwnMerchant, async (c) => {
  const merchantId = c.get("merchantId");

  const merchantLeakIds = await prisma.leak.findMany({ where: { merchantId }, select: { id: true } });

  const [leaksDetected, diagnosesRun, openOpportunities, actionsBlocked, actionsDispatched, methodConcentrationFindings, openTickets, chatThreads] =
    await Promise.all([
      Promise.resolve(merchantLeakIds.length),
      // Diagnosis has no Prisma relation to Leak (plain leakId string, like
      // every other cross-model reference in this schema) — scope through
      // the merchant's own leak ids rather than a join.
      prisma.diagnosis.count({ where: { leakId: { in: merchantLeakIds.map((l) => l.id) } } }),
      findOpportunities(merchantId).then((o) => o.filter((x) => x.verdict !== "no_action").length),
      prisma.recoveryAction.count({ where: { merchantId, shieldVerdict: "BLOCK" } }),
      prisma.recoveryAction.count({ where: { merchantId, state: "DISPATCHED" } }),
      prisma.leak.count({ where: { merchantId, class: "METHOD_CONCENTRATION" } }),
      prisma.ticket.count({ where: { merchantId, status: "OPEN" } }),
      prisma.chatThread.count({ where: { merchantId } }),
    ]);

  const activity: Record<string, number> = {
    leaksDetected,
    diagnosesRun,
    openOpportunities,
    actionsBlocked,
    actionsDispatched,
    methodConcentrationFindings,
    openTickets,
    digestAvailable: 1,
    chatThreads,
  };

  const runCounts = await prisma.agentRun.groupBy({
    by: ["agentId", "status"],
    where: { merchantId },
    _count: { _all: true },
  });
  const runCountByAgent = new Map<string, number>();
  const okRunCountByAgent = new Map<string, number>();
  for (const row of runCounts) {
    runCountByAgent.set(row.agentId, (runCountByAgent.get(row.agentId) ?? 0) + row._count._all);
    if (row.status === "ok") okRunCountByAgent.set(row.agentId, (okRunCountByAgent.get(row.agentId) ?? 0) + row._count._all);
  }

  return c.json(
    AGENT_REGISTRY.map((agent) => ({
      ...agent,
      activityCount: activity[agent.activityKey] ?? 0,
      runCount: runCountByAgent.get(agent.id) ?? 0,
      okRunCount: okRunCountByAgent.get(agent.id) ?? 0,
    })),
  );
});

agentsRoutes.get("/merchants/:id/agents/opportunities", requireOwnMerchant, async (c) => {
  const merchantId = c.get("merchantId");
  const opportunities = await findOpportunities(merchantId, { limit: 20 });
  return c.json(opportunities.map(serializeOpportunity));
});

// The Opportunities Agent's dry run, but harnessed — this is what a click
// on "Run now" in the UI hits, and it's what actually populates the run
// history the agent detail page reads.
agentsRoutes.post("/merchants/:id/agents/opportunities/run", requireOwnMerchant, async (c) => {
  const merchantId = c.get("merchantId");
  const opportunities = await recordAgentRun("opportunities", merchantId, {}, async () => {
    const found = await findOpportunities(merchantId, { limit: 20 });
    const actionable = found.filter((o) => o.verdict !== "no_action").length;
    return {
      output: found.map(serializeOpportunity),
      summary:
        actionable > 0
          ? `${actionable} of ${found.length} unaddressed leaks are worth acting on`
          : `checked ${found.length} unaddressed leaks, none clear the floor right now`,
    };
  });
  return c.json(opportunities);
});

// Live-triggerable detection — previously only ever called from
// seed-demo.ts (see LIMITATIONS.md §10). This is the same underlying
// function, just reachable from the running app and harnessed like every
// other agent.
agentsRoutes.post("/merchants/:id/agents/detector/run", requireOwnMerchant, async (c) => {
  const merchantId = c.get("merchantId");
  const result = await recordAgentRun("detector", merchantId, {}, async () => {
    const { created } = await detectLeaksForMerchant(merchantId);
    return { output: { created }, summary: created > 0 ? `found ${created} new leaks` : "no new leaks found" };
  });
  return c.json(result);
});

// The live version of what opportunities.ts only ever computed and threw
// away — see diagnosis-agent.ts's own doc comment for why this was needed.
agentsRoutes.post("/merchants/:id/agents/diagnosis/run", requireOwnMerchant, async (c) => {
  const merchantId = c.get("merchantId");
  const result = await recordAgentRun("diagnosis", merchantId, {}, async () => {
    const r = await runDiagnosisAgent(merchantId);
    return {
      output: r,
      summary:
        r.processed > 0
          ? `diagnosed ${r.processed} leak${r.processed === 1 ? "" : "s"} (${r.bySource.rules} by rules, ${r.bySource.llm} by LLM)`
          : "no undiagnosed leaks found",
    };
  });
  return c.json(result);
});

// Closes LIMITATIONS.md §10 — the live orchestration that actually
// persists RecoveryAction rows, not just a dry-run report.
agentsRoutes.post("/merchants/:id/agents/recovery/run", requireOwnMerchant, async (c) => {
  const merchantId = c.get("merchantId");
  const result = await recordAgentRun("recovery", merchantId, {}, async () => {
    const r = await runRecoveryExecutor(merchantId);
    return { output: r, summary: `reserved ${r.reserved}, blocked ${r.blocked}, no action on ${r.noAction}` };
  });
  return c.json(result);
});

// A scoped recheck of currently-pending actions — see shield-recheck.ts's
// own doc comment for exactly what is and isn't re-verified and why.
agentsRoutes.post("/merchants/:id/agents/shield/run", requireOwnMerchant, async (c) => {
  const merchantId = c.get("merchantId");
  const result = await recordAgentRun("shield", merchantId, {}, async () => {
    const r = await runShieldRecheck(merchantId);
    return {
      output: r,
      summary: r.checked > 0 ? `${r.stillPass} of ${r.checked} pending actions still pass, ${r.nowBlocked} would now be blocked` : "no pending actions to recheck",
    };
  });
  return c.json(result);
});

agentsRoutes.get("/merchants/:id/agents/:agentId/runs", requireOwnMerchant, async (c) => {
  const merchantId = c.get("merchantId");
  const agentId = c.req.param("agentId");

  const runs = await prisma.agentRun.findMany({
    where: { merchantId, agentId },
    orderBy: { startedAt: "desc" },
    take: 30,
    select: { id: true, status: true, summary: true, durationMs: true, startedAt: true },
  });

  return c.json(runs.map((r) => ({ ...r, startedAt: r.startedAt.toISOString() })));
});

agentsRoutes.get("/merchants/:id/agents/:agentId/runs/:runId", requireOwnMerchant, async (c) => {
  const merchantId = c.get("merchantId");
  const agentId = c.req.param("agentId");
  const runId = c.req.param("runId");

  const run = await prisma.agentRun.findFirst({ where: { id: runId, merchantId, agentId } });
  if (!run) return c.json({ error: "not found" }, 404);

  return c.json({ ...run, startedAt: run.startedAt.toISOString() });
});
