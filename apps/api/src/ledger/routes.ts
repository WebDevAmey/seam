import { Hono } from "hono";
import { verifyLedgerChain } from "./verify.js";

export const ledgerRoutes = new Hono();

ledgerRoutes.get("/ledger/verify", async (c) => {
  const result = await verifyLedgerChain();
  // JSON.stringify throws on a bare bigint — brokenAtSeq has to cross that
  // boundary as a string, same as every other bigint field leaving this API.
  const body = result.valid ? result : { ...result, brokenAtSeq: result.brokenAtSeq.toString() };
  return c.json(body, result.valid ? 200 : 409);
});
