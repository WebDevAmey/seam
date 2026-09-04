import { Hono } from "hono";
import { prisma } from "../prisma.js";
import { verifyLedgerChain } from "./verify.js";

export const ledgerRoutes = new Hono();

ledgerRoutes.get("/ledger/verify", async (c) => {
  const result = await verifyLedgerChain();
  // JSON.stringify throws on a bare bigint — brokenAtSeq has to cross that
  // boundary as a string, same as every other bigint field leaving this API.
  const body = result.valid ? result : { ...result, brokenAtSeq: result.brokenAtSeq.toString() };
  return c.json(body, result.valid ? 200 : 409);
});

// Filterable by merchant for display (PRD §11 screen 3) — the chain itself
// stays global; this is a view over it, not a different chain.
ledgerRoutes.get("/ledger", async (c) => {
  const merchantId = c.req.query("merchantId");
  const entries = await prisma.ledgerEntry.findMany({
    where: merchantId ? { merchantId } : undefined,
    orderBy: { seq: "desc" },
    take: 200,
  });

  return c.json(
    entries.map((entry) => ({
      seq: entry.seq.toString(),
      merchantId: entry.merchantId,
      prevHash: entry.prevHash,
      hash: entry.hash,
      payload: entry.payload,
      createdAt: entry.createdAt.toISOString(),
    })),
  );
});
