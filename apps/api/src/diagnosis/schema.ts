import { z } from "zod";

export const DIAGNOSIS_CLASSES = [
  "ISSUER_DOWNTIME",
  "METHOD_DECLINED",
  "INSUFFICIENT_FUNDS",
  "AUTH_FAILED",
  "SUSPECTED_FRAUD",
  "UNKNOWN_TRANSIENT",
  "PROMPT_INJECTION_SUSPECTED",
] as const;

/**
 * The typed contract an LLM call is constrained to (via `generateObject` +
 * this schema) — PRD §1/§7's trust boundary. `diagnosisClass` is a closed
 * enum, so it can never smuggle a digit, link, or amount on its own;
 * `reasoning` is free text and is exactly what the content validator below
 * exists to police.
 */
export const diagnosisOutputSchema = z.object({
  diagnosisClass: z.enum(DIAGNOSIS_CLASSES),
  reasoning: z.string().min(1).max(500),
  evidenceEventIds: z.array(z.string()).min(1),
});

export type DiagnosisOutput = z.infer<typeof diagnosisOutputSchema>;
