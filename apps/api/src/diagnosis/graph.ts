import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import type { BaseCheckpointSaver } from "@langchain/langgraph";
import type { DiagnosisOutput } from "./schema.js";
import { validateDiagnosisOutput } from "./validate-output.js";

const MAX_ROUNDS = 2;

export type ClassifyInput = {
  errorCode: string | null;
  errorReason: string | null;
  errorSource: string | null;
  errorStep: string | null;
  /** Shopify product titles, customer notes, checkout attributes — real
   * data, but untrusted: this is the prompt-injection attack surface
   * (PRD §8). The system prompt (in the real classifier, not this graph)
   * is what has to distinguish text that *describes* an instruction from
   * text that *is* one. */
  untrustedContext: string;
  knownEvidenceEventIds: string[];
};

/** Whatever actually calls the model — `generateObject` against OpenAI in
 * production (see `classify-with-openai.ts`), a mock in every test here.
 * Throwing (malformed JSON, a network error, a schema-violating response)
 * is a normal, expected outcome this graph has to handle, not a bug. */
export type ClassifyFn = (input: ClassifyInput) => Promise<DiagnosisOutput>;

const DiagnosisState = Annotation.Root({
  errorCode: Annotation<string | null>(),
  errorReason: Annotation<string | null>(),
  errorSource: Annotation<string | null>(),
  errorStep: Annotation<string | null>(),
  untrustedContext: Annotation<string>(),
  knownEvidenceEventIds: Annotation<string[]>(),
  attempt: Annotation<number>({ reducer: (_prev, next) => next, default: () => 0 }),
  diagnosisClass: Annotation<string>({ reducer: (_prev, next) => next, default: () => "UNKNOWN_TRANSIENT" }),
  reasoning: Annotation<string | null>({ reducer: (_prev, next) => next, default: () => null }),
  citedEvidenceIds: Annotation<string[]>({ reducer: (_prev, next) => next, default: () => [] }),
  classifyError: Annotation<string | null>({ reducer: (_prev, next) => next, default: () => null }),
  isValid: Annotation<boolean>({ reducer: (_prev, next) => next, default: () => false }),
});

export function buildDiagnosisGraph(
  classify: ClassifyFn,
  checkpointer: BaseCheckpointSaver,
  options?: { interruptAfter?: "validate"[] },
) {
  const graph = new StateGraph(DiagnosisState)
    .addNode("classify", async (state) => {
      const attempt = state.attempt + 1;
      try {
        const output = await classify({
          errorCode: state.errorCode,
          errorReason: state.errorReason,
          errorSource: state.errorSource,
          errorStep: state.errorStep,
          untrustedContext: state.untrustedContext,
          knownEvidenceEventIds: state.knownEvidenceEventIds,
        });
        return {
          attempt,
          diagnosisClass: output.diagnosisClass,
          reasoning: output.reasoning,
          citedEvidenceIds: output.evidenceEventIds,
          classifyError: null,
        };
      } catch (error) {
        return { attempt, classifyError: error instanceof Error ? error.message : "classify failed" };
      }
    })
    .addNode("validate", async (state) => {
      if (state.classifyError) return { isValid: false };
      const validation = validateDiagnosisOutput(
        {
          diagnosisClass: state.diagnosisClass as DiagnosisOutput["diagnosisClass"],
          reasoning: state.reasoning ?? "",
          evidenceEventIds: state.citedEvidenceIds,
        },
        state.knownEvidenceEventIds,
      );
      return { isValid: validation.valid };
    })
    // Round cap exhausted, still invalid — fail safe, never guess.
    .addNode("failSafe", async () => ({
      diagnosisClass: "UNKNOWN_TRANSIENT",
      reasoning: null,
      isValid: true,
    }))
    .addEdge(START, "classify")
    .addEdge("classify", "validate")
    .addConditionalEdges(
      "validate",
      (state) => {
        if (state.isValid) return "done";
        if (state.attempt < MAX_ROUNDS) return "retry";
        return "failsafe";
      },
      { done: END, retry: "classify", failsafe: "failSafe" },
    )
    .addEdge("failSafe", END);

  return graph.compile({ checkpointer, interruptAfter: options?.interruptAfter });
}
