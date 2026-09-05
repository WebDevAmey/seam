import { Hono } from "hono";
import { requireOwnMerchant, type AuthEnv } from "../auth/middleware.js";
import { recordAgentRun } from "../agents/harness.js";
import { generateDigest } from "./generate-digest.js";

export const digestRoutes = new Hono<AuthEnv>();

// Defaults to the trailing 7 days — "weekly" — but takes explicit dates so
// the same endpoint works for any period (a demo run doesn't have to wait
// a real week to show one).
digestRoutes.get("/merchants/:id/digest", requireOwnMerchant, async (c) => {
  const merchantId = c.get("merchantId");
  const endParam = c.req.query("end");
  const startParam = c.req.query("start");

  const periodEnd = endParam ? new Date(endParam) : new Date();
  const periodStart = startParam ? new Date(startParam) : new Date(periodEnd.getTime() - 7 * 24 * 3_600_000);

  const body = await recordAgentRun(
    "digest",
    merchantId,
    { start: periodStart.toISOString(), end: periodEnd.toISOString() },
    async () => {
      const digest = await generateDigest(merchantId, periodStart, periodEnd);
      const serialized = {
        ...digest,
        totalLeakAmountPaise: digest.totalLeakAmountPaise.toString(),
        netRecoveredPaise: digest.netRecoveredPaise.toString(),
        potentialRecoveryPaise: digest.potentialRecoveryPaise.toString(),
        leaksByClass: digest.leaksByClass.map((l) => ({ ...l, amountPaise: l.amountPaise.toString() })),
      };
      return { output: serialized, summary: `${digest.leaksDetected} leaks, ${digest.actionsDispatched} dispatched` };
    },
  );

  return c.json(body);
});
