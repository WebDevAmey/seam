/**
 * De-risks the one real integration-risk item in the PRD (§8, §14 block 1):
 * does LangGraph.js's Postgres checkpointer actually give crash-resumable
 * runs against the *same* database Prisma manages?
 *
 * Proven here, not assumed:
 *   1. a two-node graph runs node A, then node B fails on its first attempt
 *   2. the process "crashes" — the invoke() call rejects
 *   3. a brand-new graph instance (simulating a fresh process) resumes from
 *      the same thread_id and succeeds, WITHOUT re-running node A
 *
 * The checkpointer's tables live in their own `langgraph` schema, not
 * `public`, so there's no naming collision with Prisma's tables — confirmed
 * by inspecting the PostgresSaver API rather than assumed.
 */
import { randomUUID } from "node:crypto";
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const StateAnnotation = Annotation.Root({
  steps: Annotation<string[]>({
    reducer: (existing, update) => existing.concat(update),
    default: () => [],
  }),
});

function buildGraph(
  checkpointer: PostgresSaver,
  attemptCounters: { a: number; b: number },
) {
  return new StateGraph(StateAnnotation)
    .addNode("stepA", async () => {
      attemptCounters.a += 1;
      return { steps: ["A"] };
    })
    .addNode("stepB", async () => {
      attemptCounters.b += 1;
      if (attemptCounters.b === 1) {
        throw new Error("simulated crash in stepB, first attempt");
      }
      return { steps: ["B"] };
    })
    .addEdge(START, "stepA")
    .addEdge("stepA", "stepB")
    .addEdge("stepB", END)
    .compile({ checkpointer });
}

describe("LangGraph.js Postgres checkpointer — crash-resumable diagnosis (PRD §8)", () => {
  let checkpointer: PostgresSaver;

  beforeAll(async () => {
    checkpointer = PostgresSaver.fromConnString(process.env.DATABASE_URL!, {
      schema: "langgraph",
    });
    await checkpointer.setup();
  });

  afterAll(async () => {
    await checkpointer.end();
  });

  it("resumes after a mid-run crash without re-running the completed node", async () => {
    const threadId = randomUUID();
    const config = { configurable: { thread_id: threadId } };
    const attempts = { a: 0, b: 0 };

    const graphBeforeCrash = buildGraph(checkpointer, attempts);
    await expect(graphBeforeCrash.invoke({}, config)).rejects.toThrow(
      "simulated crash in stepB, first attempt",
    );
    expect(attempts).toEqual({ a: 1, b: 1 });

    // A fresh graph instance — same checkpointer, same thread_id — stands in
    // for a new process picking the run back up after a restart.
    const graphAfterRestart = buildGraph(checkpointer, attempts);
    const result = await graphAfterRestart.invoke(null, config);

    expect(result.steps).toEqual(["A", "B"]);
    expect(attempts).toEqual({ a: 1, b: 2 }); // A never re-ran; B retried once
  });
});
