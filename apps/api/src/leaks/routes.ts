import { Hono } from "hono";
import { requireOwnMerchant, type AuthEnv } from "../auth/middleware.js";
import { prisma } from "../prisma.js";

export const leakRoutes = new Hono<AuthEnv>();

leakRoutes.get("/merchants/:id/leaks", requireOwnMerchant, async (c) => {
  const merchantId = c.get("merchantId");
  const leaks = await prisma.leak.findMany({
    where: { merchantId },
    orderBy: { detectedAt: "desc" },
  });

  return c.json(
    leaks.map((leak) => ({
      id: leak.id,
      class: leak.class,
      amountPaise: leak.amountPaise.toString(),
      checkoutId: leak.checkoutId,
      evidenceEventIds: leak.evidenceEventIds,
      confidence: leak.confidence.toString(),
      detectedAt: leak.detectedAt.toISOString(),
    })),
  );
});
