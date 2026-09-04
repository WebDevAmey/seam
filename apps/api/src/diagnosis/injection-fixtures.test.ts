import { randomUUID } from "node:crypto";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { decide } from "../policy/decide.js";
import { INJECTION_FIXTURES } from "./injection-fixtures.js";
import { buildDiagnosisGraph, type ClassifyFn } from "./graph.js";

describe("injection fixtures are well-formed", () => {
  it("every fixture has non-empty untrusted context, and both attack and benign cases exist", () => {
    expect(INJECTION_FIXTURES.length).toBeGreaterThan(0);
    for (const fixture of INJECTION_FIXTURES) {
      expect(fixture.untrustedContext.trim().length).toBeGreaterThan(0);
    }
    expect(INJECTION_FIXTURES.some((f) => f.isAttack)).toBe(true);
    expect(INJECTION_FIXTURES.some((f) => !f.isAttack)).toBe(true);
  });
});

describe("the safety path: IF a diagnosis comes back PROMPT_INJECTION_SUSPECTED, it is never auto-actioned", () => {
  let checkpointer: PostgresSaver;

  beforeAll(async () => {
    checkpointer = PostgresSaver.fromConnString(process.env.DATABASE_URL!, { schema: "langgraph" });
    await checkpointer.setup();
  });

  afterAll(async () => {
    await checkpointer.end();
  });

  it.each(INJECTION_FIXTURES.filter((f) => f.isAttack))(
    "fixture '$id': a flagged diagnosis routes to HOLD_AND_ESCALATE, not a customer message",
    async (fixture) => {
      // Stands in for a live model that correctly detects this fixture —
      // proves the downstream handling, not detection quality (see the
      // file-level comment in injection-fixtures.ts on that distinction).
      const classify: ClassifyFn = async () => ({
        diagnosisClass: "PROMPT_INJECTION_SUSPECTED",
        reasoning: "The provided context contained an embedded instruction directed at the model.",
        evidenceEventIds: ["fe_1"],
      });

      const graph = buildDiagnosisGraph(classify, checkpointer);
      const result = await graph.invoke(
        {
          errorCode: null,
          errorReason: "payment_failed",
          errorSource: null,
          errorStep: null,
          untrustedContext: fixture.untrustedContext,
          knownEvidenceEventIds: ["fe_1"],
        },
        { configurable: { thread_id: randomUUID() } },
      );

      expect(result.diagnosisClass).toBe("PROMPT_INJECTION_SUSPECTED");

      const decision = decide({
        leakAmountPaise: 100_000n,
        diagnosisClass: result.diagnosisClass as "PROMPT_INJECTION_SUSPECTED",
        channel: "sms",
        contactsInLast7Days: 0,
        evFloorPaise: 5000n,
        now: new Date(),
      });

      expect(decision).toEqual({ kind: "action", action: { actionClass: "HOLD_AND_ESCALATE", evPaise: 0n } });
    },
  );
});
