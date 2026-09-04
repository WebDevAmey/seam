import { timingSafeEqual } from "node:crypto";
import { Hono } from "hono";
import { requireEnv } from "../env.js";
import { runSweep } from "../sweep.js";

function isAuthorised(provided: string | undefined, expected: string): boolean {
  if (!provided) return false;
  const providedBuf = Buffer.from(provided, "utf8");
  const expectedBuf = Buffer.from(expected, "utf8");
  if (providedBuf.length !== expectedBuf.length) return false;
  return timingSafeEqual(providedBuf, expectedBuf);
}

export const internalRoutes = new Hono();

// The endpoint the external keep-warm/backstop cron hits (PRD §3.3). Shared
// secret, not open on the public internet — it does real work (claims and
// resolves events), not just a health ping.
internalRoutes.post("/internal/sweep", async (c) => {
  const secret = requireEnv("SWEEP_SECRET");
  if (!isAuthorised(c.req.header("x-sweep-secret"), secret)) {
    return c.json({ error: "unauthorised" }, 401);
  }

  const result = await runSweep();
  return c.json(result);
});
