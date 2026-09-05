import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";

/**
 * The agent harness: every agent runs through this, deterministic or
 * LLM-assisted alike. It's what turns `/recovery/agents` from a static
 * description list into something you can click into and see exactly what
 * ran, when, on what input, and with what result — real history, not a
 * simulated activity feed.
 *
 * Callers hand back already-JSON-safe output (bigints as strings, same
 * convention every route in this codebase already follows before crossing
 * a JSON boundary) — the harness doesn't try to guess how to serialize an
 * arbitrary result.
 */
export async function recordAgentRun<T>(
  agentId: string,
  merchantId: string,
  input: Prisma.InputJsonValue,
  fn: () => Promise<{ output: T; summary: string }>,
): Promise<T> {
  const startedAt = Date.now();
  try {
    const { output, summary } = await fn();
    await prisma.agentRun.create({
      data: {
        merchantId,
        agentId,
        status: "ok",
        summary,
        input,
        output: output as Prisma.InputJsonValue,
        durationMs: Date.now() - startedAt,
      },
    });
    return output;
  } catch (error) {
    await prisma.agentRun.create({
      data: {
        merchantId,
        agentId,
        status: "error",
        summary: "failed",
        input,
        error: error instanceof Error ? error.message : "unknown error",
        durationMs: Date.now() - startedAt,
      },
    });
    throw error;
  }
}
