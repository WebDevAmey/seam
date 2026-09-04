export type DiagnosisClass =
  | "ISSUER_DOWNTIME"
  | "METHOD_DECLINED"
  | "INSUFFICIENT_FUNDS"
  | "AUTH_FAILED"
  | "SUSPECTED_FRAUD"
  | "UNKNOWN_TRANSIENT";

export type DiagnosisInput = {
  leakClass: string;
  errorCode?: string | null;
  errorReason?: string | null;
  errorSource?: string | null;
  errorStep?: string | null;
};

/**
 * The deterministic ~75% of diagnosis (PRD §8): a lookup table over
 * Razorpay's own error fields, no LLM. The remaining tail — reasons this
 * table doesn't recognise — falls to UNKNOWN_TRANSIENT here; the LangGraph
 * diagnosis subgraph (not yet built) is what's meant to pick those up.
 *
 * Pattern-matched, not exact-string-matched: real bank error strings vary
 * enough between issuers for the same root cause that exact matching would
 * silently under-cover. The exact pattern set here is a reasonable starting
 * point, not verified against live Razorpay test-mode data yet — expand it
 * once real payloads are available.
 */
const REASON_PATTERNS: { pattern: RegExp; diagnosis: DiagnosisClass }[] = [
  { pattern: /insufficient.?funds/i, diagnosis: "INSUFFICIENT_FUNDS" },
  { pattern: /fraud|risk|suspicious/i, diagnosis: "SUSPECTED_FRAUD" },
  { pattern: /auth(entication)?.?fail|otp|3ds/i, diagnosis: "AUTH_FAILED" },
  { pattern: /declined/i, diagnosis: "METHOD_DECLINED" },
];

export function classifyDiagnosis(input: DiagnosisInput): DiagnosisClass {
  if (input.leakClass === "ISSUER_DOWNTIME") {
    // already established by the detector — no need to re-derive it here
    return "ISSUER_DOWNTIME";
  }

  const haystack = [input.errorCode, input.errorReason, input.errorSource, input.errorStep]
    .filter((v): v is string => Boolean(v))
    .join(" ");

  for (const { pattern, diagnosis } of REASON_PATTERNS) {
    if (pattern.test(haystack)) return diagnosis;
  }

  return "UNKNOWN_TRANSIENT";
}
