import { Hono } from "hono";
import { z } from "zod";
import { requireOwnMerchant, requireSession, type AuthEnv } from "../auth/middleware.js";
import { recordAgentRun } from "../agents/harness.js";
import { prisma } from "../prisma.js";
import { handleReply } from "./handle-reply.js";

export const repliesRoutes = new Hono<AuthEnv>();

const replySchema = z.object({
  customerPhone: z.string().min(1),
  text: z.string().min(1),
});

// The inbound side of recovery messaging is simulated at the transport
// layer (see LEARNINGS.md — no real SMS/WhatsApp inbound webhook is wired
// up), so this endpoint stands in for "a reply arrived": a caller (the demo
// UI, or a future real webhook) posts the reply text against the
// RecoveryAction it's replying to, and everything downstream — classify,
// ticket, opt-out — is real. merchantId comes from the session, not the
// request body — a caller-supplied merchantId here would let anyone open
// tickets or opt-outs against a merchant that isn't theirs.
repliesRoutes.post("/recovery-actions/:id/reply", requireSession, async (c) => {
  const recoveryActionId = c.req.param("id") as string;
  const body = replySchema.safeParse(await c.req.json());
  if (!body.success) {
    return c.json({ error: body.error.issues[0]?.message ?? "invalid input" }, 400);
  }

  const merchantId = c.get("merchantId");
  const result = await recordAgentRun(
    "conversations",
    merchantId,
    { recoveryActionId, text: body.data.text },
    async () => {
      const outcome = await handleReply({
        merchantId,
        recoveryActionId,
        customerPhone: body.data.customerPhone,
        text: body.data.text,
      });
      return {
        output: outcome,
        summary: outcome.ticketId ? `classified as ${outcome.replyClass}, opened a ticket` : `classified as ${outcome.replyClass}, no ticket needed`,
      };
    },
  );

  return c.json(result, 201);
});

repliesRoutes.get("/merchants/:id/tickets", requireOwnMerchant, async (c) => {
  const merchantId = c.get("merchantId");
  const status = c.req.query("status");

  const tickets = await prisma.ticket.findMany({
    where: { merchantId, ...(status ? { status } : {}) },
    orderBy: { createdAt: "desc" },
  });

  return c.json(tickets);
});
