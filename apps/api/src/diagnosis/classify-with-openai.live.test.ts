import { describe, expect, it } from "vitest";
import { classifyWithOpenAI } from "./classify-with-openai.js";
import { INJECTION_FIXTURES } from "./injection-fixtures.js";

/**
 * Calls a real LLM (Groq, via `diagnosisModel()` in `src/llm/providers.ts`)
 * — closes the gap `injection-fixtures.ts`'s file-level comment named:
 * this actually measures whether the model detects each fixture, not just
 * that the downstream safety path handles a flagged diagnosis correctly
 * (that half is proven separately, against a mock, in `graph.test.ts`).
 * Skips itself, quietly, when there's no GROQ_API_KEY.
 *
 * `retry: 2` on every case here mirrors production's own resilience
 * (`graph.ts`'s `MAX_ROUNDS = 2` retries a `classifyWithOpenAI` throw or
 * timeout automatically) rather than masking a real bug — a single call
 * occasionally queues past the 4s per-round budget under this test file's
 * own concurrent load, which the graph is specifically built to absorb.
 */
describe.skipIf(!process.env.GROQ_API_KEY)("classifyWithOpenAI — live, against a real Groq model", () => {
  it.each(INJECTION_FIXTURES)(
    "fixture '$id' ($description) is classified as PROMPT_INJECTION_SUSPECTED iff isAttack=$isAttack",
    { timeout: 10_000, retry: 2 },
    async (fixture) => {
      const result = await classifyWithOpenAI({
        errorCode: null,
        errorReason: "payment_failed",
        errorSource: null,
        errorStep: null,
        untrustedContext: fixture.untrustedContext,
        knownEvidenceEventIds: ["fe_1"],
      });

      if (fixture.isAttack) {
        expect(result.diagnosisClass).toBe("PROMPT_INJECTION_SUSPECTED");
      } else {
        expect(result.diagnosisClass).not.toBe("PROMPT_INJECTION_SUSPECTED");
      }
    },
  );

  it("classifies a plain decline with no untrusted-context tricks, citing only known evidence ids", { timeout: 10_000, retry: 2 }, async () => {
    const result = await classifyWithOpenAI({
      errorCode: "BAD_REQUEST_ERROR",
      errorReason: "payment_declined",
      errorSource: "issuer",
      errorStep: "payment_authentication",
      untrustedContext: "Product: Cotton Kurta, Size M. Customer note: please deliver after 6pm.",
      knownEvidenceEventIds: ["fe_1", "fe_2"],
    });

    expect(result.diagnosisClass).not.toBe("PROMPT_INJECTION_SUSPECTED");
    for (const id of result.evidenceEventIds) {
      expect(["fe_1", "fe_2"]).toContain(id);
    }
  });
});
