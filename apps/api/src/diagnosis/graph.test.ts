import { randomUUID } from "node:crypto";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { buildDiagnosisGraph, type ClassifyFn } from "./graph.js";
import type { DiagnosisOutput } from "./schema.js";

const KNOWN_IDS = ["fe_1", "pa_1"];

function baseState() {
  return {
    errorCode: null,
    errorReason: "card_declined",
    errorSource: "bank",
    errorStep: "authorization",
    untrustedContext: "",
    knownEvidenceEventIds: KNOWN_IDS,
  };
}

function validOutput(overrides: Partial<DiagnosisOutput> = {}): DiagnosisOutput {
  return {
    diagnosisClass: "METHOD_DECLINED",
    reasoning: "The issuing bank declined this transaction.",
    evidenceEventIds: ["fe_1", "pa_1"],
    ...overrides,
  };
}

describe("diagnosis graph — retry and fail-safe routing (PRD §8: max 2 rounds, fail-safe to UNKNOWN_TRANSIENT)", () => {
  let checkpointer: PostgresSaver;

  beforeAll(async () => {
    checkpointer = PostgresSaver.fromConnString(process.env.DATABASE_URL!, { schema: "langgraph" });
    await checkpointer.setup();
  });

  afterAll(async () => {
    await checkpointer.end();
  });

  it("succeeds on the first round when the output is valid", async () => {
    const classify: ClassifyFn = vi.fn().mockResolvedValue(validOutput());
    const graph = buildDiagnosisGraph(classify, checkpointer);
    const config = { configurable: { thread_id: randomUUID() } };

    const result = await graph.invoke(baseState(), config);

    expect(result.diagnosisClass).toBe("METHOD_DECLINED");
    expect(result.attempt).toBe(1);
    expect(classify).toHaveBeenCalledTimes(1);
  });

  it("retries once when the first output cites an evidence id that doesn't exist, then succeeds", async () => {
    const classify: ClassifyFn = vi
      .fn()
      .mockResolvedValueOnce(validOutput({ evidenceEventIds: ["not_real"] }))
      .mockResolvedValueOnce(validOutput());
    const graph = buildDiagnosisGraph(classify, checkpointer);
    const config = { configurable: { thread_id: randomUUID() } };

    const result = await graph.invoke(baseState(), config);

    expect(result.diagnosisClass).toBe("METHOD_DECLINED");
    expect(result.attempt).toBe(2);
    expect(classify).toHaveBeenCalledTimes(2);
  });

  it("falls back to UNKNOWN_TRANSIENT after the round cap, never guesses", async () => {
    const classify: ClassifyFn = vi.fn().mockResolvedValue(validOutput({ evidenceEventIds: ["not_real"] }));
    const graph = buildDiagnosisGraph(classify, checkpointer);
    const config = { configurable: { thread_id: randomUUID() } };

    const result = await graph.invoke(baseState(), config);

    expect(result.diagnosisClass).toBe("UNKNOWN_TRANSIENT");
    expect(classify).toHaveBeenCalledTimes(2); // exactly the round cap, no more
  });

  it("treats a thrown error from classify (malformed JSON, a network failure) the same as an invalid result — retries, then fails safe", async () => {
    const classify: ClassifyFn = vi.fn().mockRejectedValue(new Error("malformed model response"));
    const graph = buildDiagnosisGraph(classify, checkpointer);
    const config = { configurable: { thread_id: randomUUID() } };

    const result = await graph.invoke(baseState(), config);

    expect(result.diagnosisClass).toBe("UNKNOWN_TRANSIENT");
    expect(classify).toHaveBeenCalledTimes(2);
  });

  it("recovers from one thrown error followed by a valid result", async () => {
    const classify: ClassifyFn = vi
      .fn()
      .mockRejectedValueOnce(new Error("malformed model response"))
      .mockResolvedValueOnce(validOutput());
    const graph = buildDiagnosisGraph(classify, checkpointer);
    const config = { configurable: { thread_id: randomUUID() } };

    const result = await graph.invoke(baseState(), config);

    expect(result.diagnosisClass).toBe("METHOD_DECLINED");
    expect(result.attempt).toBe(2);
  });

  it("resumes after a crash between rounds instead of losing round 1's progress", async () => {
    // interruptAfter is the idiomatic LangGraph way to stop a run right
    // after a checkpoint commits, without throwing. It's the same
    // mechanism a real crash relies on: a fresh process resuming a thread
    // has no way to tell "deliberately paused" from "the old process died"
    // apart — the checkpoint on disk is identical either way.
    const threadId = randomUUID();
    const config = { configurable: { thread_id: threadId } };

    const round1Classify: ClassifyFn = vi.fn().mockResolvedValue(validOutput({ evidenceEventIds: ["not_real"] }));
    const crashedGraph = buildDiagnosisGraph(round1Classify, checkpointer, { interruptAfter: ["validate"] });

    const paused = await crashedGraph.invoke(baseState(), config);
    expect(round1Classify).toHaveBeenCalledTimes(1);
    expect(paused.attempt).toBe(1);
    expect(paused.isValid).toBe(false); // round 1 was invalid — checkpointed mid-retry-loop, not at a natural end

    // A fresh graph instance — same checkpointer, same thread — standing in
    // for a new process picking the run back up, with no interrupt this time.
    const recoveringClassify: ClassifyFn = vi.fn().mockResolvedValue(validOutput());
    const graph2 = buildDiagnosisGraph(recoveringClassify, checkpointer);
    const result = await graph2.invoke(null, config);

    expect(result.diagnosisClass).toBe("METHOD_DECLINED");
    expect(result.attempt).toBe(2); // round 1 wasn't re-run — it resumed straight into round 2
    expect(recoveringClassify).toHaveBeenCalledTimes(1);
  });
});
