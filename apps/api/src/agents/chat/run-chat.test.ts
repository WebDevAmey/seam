import { randomUUID } from "node:crypto";
import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";
import { prisma } from "../../prisma.js";
import { sendChatMessage } from "./run-chat.js";

async function seedMerchant() {
  return prisma.merchant.create({ data: { name: "Chat Test", email: `${randomUUID()}@example.com` } });
}

const USAGE = { inputTokens: { total: 10 }, outputTokens: { total: 5 }, totalTokens: { total: 15 } };

function mockModel(scripted: unknown[]) {
  return new MockLanguageModelV4({ doGenerate: scripted as never });
}

describe("sendChatMessage — orchestration and persistence, no real model needed", () => {
  it("a plain text reply (no tool call) gets persisted as one user + one assistant message in a new thread", async () => {
    const merchant = await seedMerchant();
    const model = mockModel([
      {
        content: [{ type: "text", text: "Hi! Ask me about your leaks, recovery actions, or ledger." }],
        finishReason: { unified: "stop", raw: undefined },
        usage: USAGE,
        warnings: [],
      },
    ]);

    const result = await sendChatMessage(merchant.id, null, "hello", model);

    expect(result.reply).toContain("Ask me about your leaks");
    expect(result.toolCalls).toHaveLength(0);

    const messages = await prisma.chatMessage.findMany({ where: { threadId: result.threadId }, orderBy: { createdAt: "asc" } });
    expect(messages).toHaveLength(2);
    expect(messages[0]?.role).toBe("user");
    expect(messages[0]?.content).toBe("hello");
    expect(messages[1]?.role).toBe("assistant");
  });

  it("a tool call gets executed for real, and the trail is returned and persisted", async () => {
    const merchant = await seedMerchant();
    await prisma.leak.create({
      data: {
        merchantId: merchant.id,
        class: "PAYMENT_BLOCKED",
        amountPaise: 42_000n,
        checkoutId: "c1",
        evidenceEventIds: ["fe1"],
        confidence: 1,
        detectedAt: new Date(),
      },
    });

    const model = mockModel([
      {
        content: [
          { type: "tool-call", toolCallId: "call_1", toolName: "getRevenueLeakSummary", input: JSON.stringify({ days: 14 }) },
        ],
        finishReason: { unified: "tool-calls", raw: undefined },
        usage: USAGE,
        warnings: [],
      },
      {
        content: [{ type: "text", text: "You've leaked ₹420 in the last 14 days, all payment-blocked." }],
        finishReason: { unified: "stop", raw: undefined },
        usage: USAGE,
        warnings: [],
      },
    ]);

    const result = await sendChatMessage(merchant.id, null, "how much have I leaked?", model);

    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0]?.toolName).toBe("getRevenueLeakSummary");
    expect((result.toolCalls[0]?.output as { totalLeakedPaise: string }).totalLeakedPaise).toBe("42000");
    expect(result.reply).toContain("₹420");

    const stored = await prisma.chatMessage.findFirst({ where: { threadId: result.threadId, role: "assistant" } });
    expect(stored?.toolCalls).not.toBeNull();
  });

  it("a second message in the same thread carries prior history forward", async () => {
    const merchant = await seedMerchant();
    const firstModel = mockModel([
      { content: [{ type: "text", text: "Sure, ask away." }], finishReason: { unified: "stop", raw: undefined }, usage: USAGE, warnings: [] },
    ]);
    const first = await sendChatMessage(merchant.id, null, "hi", firstModel);

    const secondModel = mockModel([
      { content: [{ type: "text", text: "Still here." }], finishReason: { unified: "stop", raw: undefined }, usage: USAGE, warnings: [] },
    ]);
    const second = await sendChatMessage(merchant.id, first.threadId, "you there?", secondModel);

    expect(second.threadId).toBe(first.threadId);
    const messages = await prisma.chatMessage.findMany({ where: { threadId: first.threadId }, orderBy: { createdAt: "asc" } });
    expect(messages).toHaveLength(4);
  });

  it("throws for a thread id that doesn't belong to this merchant", async () => {
    const merchant = await seedMerchant();
    const other = await seedMerchant();
    const thread = await prisma.chatThread.create({ data: { merchantId: other.id, title: "not yours" } });

    await expect(sendChatMessage(merchant.id, thread.id, "hi", mockModel([]))).rejects.toThrow(/not found/);
  });
});
