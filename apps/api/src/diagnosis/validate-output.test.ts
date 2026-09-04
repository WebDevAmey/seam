import { describe, expect, it } from "vitest";
import type { DiagnosisOutput } from "./schema.js";
import { validateDiagnosisOutput } from "./validate-output.js";

const KNOWN_IDS = ["fe_1", "pa_1", "pa_2"];

function output(overrides: Partial<DiagnosisOutput> = {}): DiagnosisOutput {
  return {
    diagnosisClass: "METHOD_DECLINED",
    reasoning: "The card issuer declined the transaction outright.",
    evidenceEventIds: ["fe_1", "pa_1"],
    ...overrides,
  };
}

describe("validateDiagnosisOutput — the actual trust-boundary enforcement (PRD §1, §7, §8)", () => {
  it("passes clean reasoning citing only real evidence ids", () => {
    expect(validateDiagnosisOutput(output(), KNOWN_IDS)).toEqual({ valid: true, output: output() });
  });

  it("rejects reasoning containing a digit", () => {
    const result = validateDiagnosisOutput(
      output({ reasoning: "This failed on the 3rd attempt today." }),
      KNOWN_IDS,
    );
    expect(result.valid).toBe(false);
  });

  it("rejects reasoning containing a ₹ amount", () => {
    const result = validateDiagnosisOutput(output({ reasoning: "The customer owes ₹five hundred." }), KNOWN_IDS);
    expect(result.valid).toBe(false);
  });

  it("rejects reasoning containing a URL", () => {
    const result = validateDiagnosisOutput(
      output({ reasoning: "See https://example.com for more context." }),
      KNOWN_IDS,
    );
    expect(result.valid).toBe(false);
  });

  it("rejects a cited evidence id that doesn't exist", () => {
    const result = validateDiagnosisOutput(output({ evidenceEventIds: ["fe_1", "not_a_real_id"] }), KNOWN_IDS);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toContain("not_a_real_id");
  });

  it("lists every unknown id, not just the first one, when several are wrong", () => {
    const result = validateDiagnosisOutput(
      output({ evidenceEventIds: ["ghost_1", "ghost_2"] }),
      KNOWN_IDS,
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toContain("ghost_1");
      expect(result.reason).toContain("ghost_2");
    }
  });
});
