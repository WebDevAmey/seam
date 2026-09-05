import { tool } from "ai";
import { z } from "zod";
import { getAnalyticsSummary } from "../../analytics/summary.js";
import { verifyLedgerChain } from "../../ledger/verify.js";
import { prisma } from "../../prisma.js";
import { findOpportunities } from "../opportunities.js";

/**
 * The real logic behind every chat tool, kept separate from the `ai` SDK's
 * `tool()` wrapper below so it's testable directly — call these functions
 * in a test the same way any other function in this codebase gets tested,
 * no LLM or mocked tool-call context required. `buildStoreTools` at the
 * bottom is the only place that couples this logic to the AI SDK's shape.
 *
 * Every function here is a thin, JSON-safe wrapper around something that
 * already exists and is already tested elsewhere (`getAnalyticsSummary`,
 * `findOpportunities`, `verifyLedgerChain`) — the model never computes a
 * number itself, it only calls these and reports what comes back. Same
 * trust boundary as diagnosis (PRD §8): the model proposes which tool to
 * call and how to phrase the answer; it never authors a rupee figure, a
 * leak count, or a verdict.
 */
export async function getRevenueLeakSummary(merchantId: string, days: number) {
  const summary = await getAnalyticsSummary(merchantId, { days });
  return {
    windowDays: days,
    totalLeakedPaise: summary.dailySeries.reduce((sum, d) => sum + d.leakAmountPaise, 0n).toString(),
    totalRecoveredPaise: summary.dailySeries.reduce((sum, d) => sum + d.recoveredPaise, 0n).toString(),
    byLeakClass: summary.byClass.map((c) => ({ ...c, amountPaise: c.amountPaise.toString() })),
    byPaymentMethod: summary.byMethod,
    shieldFunnel: summary.funnel,
  };
}

export async function getTopOpportunities(merchantId: string, limit: number) {
  const opportunities = await findOpportunities(merchantId, { limit });
  return opportunities.map((o) => ({
    leakClass: o.leakClass,
    diagnosisClass: o.diagnosisClass,
    amountPaise: o.amountPaise.toString(),
    verdict: o.verdict,
    reason: o.reason,
    predictedRecoveryPaise: o.evPaise,
  }));
}

export async function getOpenConversations(merchantId: string) {
  return prisma.ticket.findMany({
    where: { merchantId, status: "OPEN" },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { replyClass: true, replyText: true, createdAt: true },
  });
}

export async function checkLedgerIntegrity() {
  const result = await verifyLedgerChain();
  return result.valid ? { valid: true } : { valid: false, brokenAtSeq: result.brokenAtSeq.toString(), reason: result.reason };
}

export function buildStoreTools(merchantId: string) {
  return {
    getRevenueLeakSummary: tool({
      description:
        "Get real, aggregated revenue-leak and recovery numbers for this merchant over a trailing window: total leaked, total recovered (predicted EV), a breakdown by leak cause, a breakdown by payment method's failure rate, and the Shield decision funnel.",
      inputSchema: z.object({
        days: z.number().int().min(1).max(90).default(14).describe("How many trailing days to summarize."),
      }),
      execute: async ({ days }: { days: number }) => getRevenueLeakSummary(merchantId, days),
    }),

    getTopOpportunities: tool({
      description:
        "Get the highest-value leaks that haven't been acted on yet, ranked by predicted recovery value, along with what Seam's Policy + Shield would do about each (dispatch a recovery message, hold for human approval, or decline as not worth contacting).",
      inputSchema: z.object({
        limit: z.number().int().min(1).max(20).default(5).describe("Max opportunities to return."),
      }),
      execute: async ({ limit }: { limit: number }) => getTopOpportunities(merchantId, limit),
    }),

    getOpenConversations: tool({
      description:
        "Get open customer-reply conversations that need a human's attention: refusals, opt-outs, or replies the classifier couldn't confidently place.",
      inputSchema: z.object({}),
      execute: async () => getOpenConversations(merchantId),
    }),

    checkLedgerIntegrity: tool({
      description: "Verify whether Seam's hash-chained audit ledger is intact, recomputing the entire chain from genesis.",
      inputSchema: z.object({}),
      execute: async () => checkLedgerIntegrity(),
    }),
  };
}
