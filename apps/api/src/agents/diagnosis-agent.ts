import { classifyDiagnosis } from "../diagnosis/classify-diagnosis.js";
import { classifyWithOpenAI } from "../diagnosis/classify-with-openai.js";
import type { ClassifyInput } from "../diagnosis/graph.js";
import type { DiagnosisOutput } from "../diagnosis/schema.js";
import { prisma } from "../prisma.js";

// Same two classes opportunities.ts scopes itself to: the only leak classes
// that have a PaymentAttempt row with error fields worth diagnosing.
const DIAGNOSABLE_CLASSES = ["PAYMENT_BLOCKED", "ISSUER_DOWNTIME"];

export type DiagnosisRunResult = { processed: number; bySource: { rules: number; llm: number } };

/**
 * The live version of what `opportunities.ts` only ever computed inline and
 * threw away: this persists a real `Diagnosis` row per leak (previously
 * nothing in the running app ever wrote to that table at all — the fleet
 * page's "diagnoses run" count had always read 0). Deterministic
 * pattern-matching (`classifyDiagnosis`) resolves most leaks; the ones it
 * can't (UNKNOWN_TRANSIENT) escalate to the live, schema-constrained LLM
 * path (`classifyWithOpenAI`, Groq — see `src/llm/providers.ts`) when a key
 * is configured, exactly the routing PRD §8 and the agent registry's own
 * description describe.
 */
export async function runDiagnosisAgent(
  merchantId: string,
  classifyFn: (input: ClassifyInput) => Promise<DiagnosisOutput> = classifyWithOpenAI,
): Promise<DiagnosisRunResult> {
  const [leaks, diagnosedRows] = await Promise.all([
    prisma.leak.findMany({ where: { merchantId, class: { in: DIAGNOSABLE_CLASSES } } }),
    prisma.diagnosis.findMany({ select: { leakId: true } }),
  ]);
  const diagnosed = new Set(diagnosedRows.map((d) => d.leakId));
  const pending = leaks.filter((leak) => !diagnosed.has(leak.id));

  const hasLiveModel = Boolean(process.env.GROQ_API_KEY);
  let rules = 0;
  let llm = 0;

  for (const leak of pending) {
    const attempt = leak.checkoutId
      ? await prisma.paymentAttempt.findFirst({ where: { merchantId, checkoutId: leak.checkoutId } })
      : null;
    const startedAt = Date.now();

    const ruleResult = classifyDiagnosis({
      leakClass: leak.class,
      errorCode: attempt?.errorCode ?? null,
      errorReason: attempt?.errorReason ?? null,
      errorSource: attempt?.errorSource ?? null,
      errorStep: attempt?.errorStep ?? null,
    });

    if (ruleResult !== "UNKNOWN_TRANSIENT" || !hasLiveModel) {
      await prisma.diagnosis.create({
        data: {
          leakId: leak.id,
          diagnosisClass: ruleResult,
          confidence: ruleResult === "UNKNOWN_TRANSIENT" ? 0.4 : 0.95,
          source: "rules",
          evidenceEventIds: leak.evidenceEventIds,
          latencyMs: Date.now() - startedAt,
        },
      });
      rules++;
      continue;
    }

    try {
      const llmResult = await classifyFn({
        errorCode: attempt?.errorCode ?? null,
        errorReason: attempt?.errorReason ?? null,
        errorSource: attempt?.errorSource ?? null,
        errorStep: attempt?.errorStep ?? null,
        untrustedContext: attempt?.errorDescription ?? "(no additional context)",
        knownEvidenceEventIds: leak.evidenceEventIds,
      });
      await prisma.diagnosis.create({
        data: {
          leakId: leak.id,
          diagnosisClass: llmResult.diagnosisClass,
          confidence: 0.75,
          source: "llm",
          modelName: "openai/gpt-oss-20b (groq)",
          evidenceEventIds: llmResult.evidenceEventIds,
          latencyMs: Date.now() - startedAt,
        },
      });
      llm++;
    } catch {
      // A real, expected failure mode (network error, timeout, malformed
      // output) — same "throwing is normal, not a bug" posture as the
      // LangGraph diagnosis subgraph. Falls back to the rules verdict
      // rather than leaving the leak permanently undiagnosed.
      await prisma.diagnosis.create({
        data: {
          leakId: leak.id,
          diagnosisClass: "UNKNOWN_TRANSIENT",
          confidence: 0.4,
          source: "rules",
          evidenceEventIds: leak.evidenceEventIds,
          latencyMs: Date.now() - startedAt,
        },
      });
      rules++;
    }
  }

  return { processed: pending.length, bySource: { rules, llm } };
}
