import { Hono } from "hono";
import { z } from "zod";
import { requireOwnMerchant, type AuthEnv } from "../../auth/middleware.js";
import { prisma } from "../../prisma.js";
import { recordAgentRun } from "../harness.js";
import { sendChatMessage } from "./run-chat.js";

export const chatRoutes = new Hono<AuthEnv>();

const sendSchema = z.object({
  threadId: z.string().nullable().optional(),
  message: z.string().min(1).max(2000),
});

chatRoutes.post("/merchants/:id/chat", requireOwnMerchant, async (c) => {
  const merchantId = c.get("merchantId");
  const body = sendSchema.safeParse(await c.req.json());
  if (!body.success) {
    return c.json({ error: body.error.issues[0]?.message ?? "invalid input" }, 400);
  }

  try {
    const result = await recordAgentRun(
      "store_chat",
      merchantId,
      { threadId: body.data.threadId ?? null, message: body.data.message },
      async () => {
        const turn = await sendChatMessage(merchantId, body.data.threadId ?? null, body.data.message);
        return {
          output: turn,
          summary: turn.toolCalls.length > 0 ? `called ${turn.toolCalls.map((t) => t.toolName).join(", ")}` : "answered directly",
        };
      },
    );
    return c.json(result);
  } catch (error) {
    if (error instanceof Error && error.message.includes("not found")) {
      return c.json({ error: "thread not found" }, 404);
    }
    if (error instanceof Error && /api[_-]?key/i.test(error.message)) {
      return c.json({ error: "no OPENROUTER_API_KEY configured. Set one in apps/api/.env to use chat" }, 503);
    }
    throw error;
  }
});

chatRoutes.get("/merchants/:id/chat/threads", requireOwnMerchant, async (c) => {
  const merchantId = c.get("merchantId");
  const threads = await prisma.chatThread.findMany({
    where: { merchantId },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  return c.json(threads.map((t) => ({ ...t, createdAt: t.createdAt.toISOString() })));
});

chatRoutes.get("/merchants/:id/chat/threads/:threadId", requireOwnMerchant, async (c) => {
  const merchantId = c.get("merchantId");
  const threadId = c.req.param("threadId");

  const thread = await prisma.chatThread.findFirst({ where: { id: threadId, merchantId } });
  if (!thread) return c.json({ error: "not found" }, 404);

  const messages = await prisma.chatMessage.findMany({ where: { threadId }, orderBy: { createdAt: "asc" } });
  return c.json({
    thread: { ...thread, createdAt: thread.createdAt.toISOString() },
    messages: messages.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() })),
  });
});
