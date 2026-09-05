import { Hono } from "hono";
import { requireOwnMerchant, requireSession, type AuthEnv } from "../auth/middleware.js";
import { prisma } from "../prisma.js";
import { approveAction, rejectAction } from "./review-action.js";

export const recoveryActionRoutes = new Hono<AuthEnv>();

recoveryActionRoutes.get("/merchants/:id/recovery-actions", requireOwnMerchant, async (c) => {
  const merchantId = c.get("merchantId");
  const actions = await prisma.recoveryAction.findMany({
    where: { merchantId },
    orderBy: { createdAt: "desc" },
  });

  return c.json(
    actions.map((action) => ({
      id: action.id,
      checkoutId: action.checkoutId,
      leakId: action.leakId,
      actionClass: action.actionClass,
      state: action.state,
      evPaise: action.evPaise.toString(),
      shieldVerdict: action.shieldVerdict,
      shieldReason: action.shieldReason,
      rzpRef: action.rzpRef,
      createdAt: action.createdAt.toISOString(),
      dispatchedAt: action.dispatchedAt?.toISOString() ?? null,
    })),
  );
});

recoveryActionRoutes.post("/recovery-actions/:id/approve", requireSession, async (c) => {
  const merchantId = c.get("merchantId");
  try {
    const result = await approveAction(c.req.param("id") as string, merchantId);
    return c.json(result, result.outcome === "not_connected" ? 409 : 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return c.json({ error: message }, message.includes("not found") ? 404 : 400);
  }
});

recoveryActionRoutes.post("/recovery-actions/:id/reject", requireSession, async (c) => {
  const merchantId = c.get("merchantId");
  const body = await c.req.json().catch(() => ({}));
  const reason = typeof body?.reason === "string" ? body.reason : undefined;
  try {
    const result = await rejectAction(c.req.param("id") as string, merchantId, reason);
    return c.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return c.json({ error: message }, message.includes("not found") ? 404 : 400);
  }
});
