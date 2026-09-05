import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { prisma } from "../../prisma.js";
import { sendChatMessage } from "./run-chat.js";

/**
 * Calls a real LLM (OpenRouter, via `chatModel()` in `src/llm/providers.ts`)
 * — the on-ramp for proving the real thing works the moment a key exists,
 * instead of just asserting "never exercised live" forever. It skips
 * itself, quietly, when there's no OPENROUTER_API_KEY — it does not fail
 * the suite for anyone who hasn't set one (see README's setup steps).
 */
describe.skipIf(!process.env.OPENROUTER_API_KEY)("sendChatMessage — live, against a real OpenRouter model", () => {
  it(
    "answers a real question about this merchant's own leaks by actually calling the getRevenueLeakSummary tool",
    async () => {
      const merchant = await prisma.merchant.create({
        data: { name: "Live Chat Test", email: `${randomUUID()}@example.com` },
      });
      await prisma.leak.create({
        data: {
          merchantId: merchant.id,
          class: "PAYMENT_BLOCKED",
          amountPaise: 123_00n,
          checkoutId: "c1",
          evidenceEventIds: ["fe1"],
          confidence: 1,
          detectedAt: new Date(),
        },
      });

      const result = await sendChatMessage(merchant.id, null, "How much revenue have I leaked recently?");

      expect(result.toolCalls.length).toBeGreaterThan(0);
      expect(result.toolCalls.some((t) => t.toolName === "getRevenueLeakSummary")).toBe(true);
      expect(result.reply.length).toBeGreaterThan(0);
    },
    20_000,
  );
});
