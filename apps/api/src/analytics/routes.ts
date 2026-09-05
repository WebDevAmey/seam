import { Hono } from "hono";
import { requireOwnMerchant, type AuthEnv } from "../auth/middleware.js";
import { getAnalyticsSummary } from "./summary.js";

export const analyticsRoutes = new Hono<AuthEnv>();

analyticsRoutes.get("/merchants/:id/analytics/summary", requireOwnMerchant, async (c) => {
  const merchantId = c.get("merchantId");
  const days = Number(c.req.query("days") ?? "14");

  const summary = await getAnalyticsSummary(merchantId, { days });
  return c.json({
    dailySeries: summary.dailySeries.map((d) => ({
      ...d,
      leakAmountPaise: d.leakAmountPaise.toString(),
      recoveredPaise: d.recoveredPaise.toString(),
    })),
    byClass: summary.byClass.map((c) => ({ ...c, amountPaise: c.amountPaise.toString() })),
    byMethod: summary.byMethod,
    funnel: summary.funnel,
  });
});
