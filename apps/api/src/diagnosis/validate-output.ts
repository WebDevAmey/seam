import type { DiagnosisOutput } from "./schema.js";

export type ValidationResult =
  | { valid: true; output: DiagnosisOutput }
  | { valid: false; reason: string };

// Any digit, any ₹, any URL — the exact rule from PRD §1/§7/§8: the model
// never authors an amount, a link, or a deadline into free text.
const FORBIDDEN_CONTENT = /\d|₹|https?:\/\/|www\./i;

/**
 * The second half of the trust boundary — the schema constrains *shape*,
 * this constrains *content and grounding*. Both have to pass before a
 * model-authored diagnosis is trusted for anything.
 */
export function validateDiagnosisOutput(
  output: DiagnosisOutput,
  knownEvidenceEventIds: readonly string[],
): ValidationResult {
  if (FORBIDDEN_CONTENT.test(output.reasoning)) {
    return { valid: false, reason: "reasoning contains a digit, ₹ span, or URL" };
  }

  const known = new Set(knownEvidenceEventIds);
  const unknownIds = output.evidenceEventIds.filter((id) => !known.has(id));
  if (unknownIds.length > 0) {
    return { valid: false, reason: `cited evidence ids don't exist: ${unknownIds.join(", ")}` };
  }

  return { valid: true, output };
}
