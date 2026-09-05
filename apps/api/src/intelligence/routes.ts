import { Hono } from "hono";
import { requireOwnMerchant, type AuthEnv } from "../auth/middleware.js";
import { recordAgentRun } from "../agents/harness.js";
import { analyzeLeakIntelligence } from "./analyze-merchant.js";

export const intelligenceRoutes = new Hono<AuthEnv>();

// On-demand rather than folded into the sweep: this is an expensive,
// merchant-wide scan (every PaymentAttempt ever recorded), not a per-event
// operation, so it doesn't belong on the same fast path as webhook resolve.
intelligenceRoutes.post("/merchants/:id/intelligence/analyze", requireOwnMerchant, async (c) => {
  const merchantId = c.get("merchantId");
  const today = c.req.query("date") ?? new Date().toISOString().slice(0, 10);

  const body = await recordAgentRun("intelligence", merchantId, { date: today }, async () => {
    const result = await analyzeLeakIntelligence(merchantId, today);
    const findings = result.findings.map((f) => ({
      method: f.method,
      currentRate: f.currentRate,
      baselineMean: f.baselineMean,
      baselineStdDev: f.baselineStdDev,
      zScore: f.zScore,
      sampleSize: f.sampleSize,
    }));
    return {
      output: { today, findings, leaksCreated: result.leaksCreated },
      summary:
        result.leaksCreated > 0
          ? `flagged ${result.leaksCreated} method-concentration ${result.leaksCreated === 1 ? "leak" : "leaks"}`
          : `checked every method, nothing crossed the 2σ threshold`,
    };
  });

  return c.json(body);
});
