import { Hono } from "hono";
import { prisma } from "../prisma.js";

export const recoveryActionRoutes = new Hono();

recoveryActionRoutes.get("/merchants/:id/recovery-actions", async (c) => {
  const merchantId = c.req.param("id");
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
