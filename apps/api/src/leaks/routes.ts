import { Hono } from "hono";
import { prisma } from "../prisma.js";

export const leakRoutes = new Hono();

leakRoutes.get("/merchants/:id/leaks", async (c) => {
  const merchantId = c.req.param("id");
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
