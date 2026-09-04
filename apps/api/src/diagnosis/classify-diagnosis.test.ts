import { describe, expect, it } from "vitest";
import { classifyDiagnosis } from "./classify-diagnosis.js";

describe("classifyDiagnosis — the deterministic ~75% path (PRD §8), no LLM involved", () => {
  it("trusts ISSUER_DOWNTIME straight from the leak class — already known from detection", () => {
    expect(classifyDiagnosis({ leakClass: "ISSUER_DOWNTIME", errorReason: "anything" })).toBe(
      "ISSUER_DOWNTIME",
    );
  });

  it("maps insufficient-funds-shaped reasons to INSUFFICIENT_FUNDS", () => {
    expect(classifyDiagnosis({ leakClass: "PAYMENT_BLOCKED", errorReason: "insufficient_funds" })).toBe(
      "INSUFFICIENT_FUNDS",
    );
  });

  it("maps a declined-card reason to METHOD_DECLINED", () => {
    expect(classifyDiagnosis({ leakClass: "PAYMENT_BLOCKED", errorReason: "card_declined" })).toBe(
      "METHOD_DECLINED",
    );
  });

  it("maps an OTP/auth failure to AUTH_FAILED", () => {
    expect(classifyDiagnosis({ leakClass: "PAYMENT_BLOCKED", errorReason: "invalid_otp" })).toBe(
      "AUTH_FAILED",
    );
  });

  it("maps a fraud/risk signal to SUSPECTED_FRAUD", () => {
    expect(classifyDiagnosis({ leakClass: "PAYMENT_BLOCKED", errorReason: "fraud_suspected" })).toBe(
      "SUSPECTED_FRAUD",
    );
  });

  it("is case-insensitive and checks errorCode/errorSource/errorStep too, not just errorReason", () => {
    expect(
      classifyDiagnosis({ leakClass: "PAYMENT_BLOCKED", errorCode: "INSUFFICIENT_FUNDS_ERROR" }),
    ).toBe("INSUFFICIENT_FUNDS");
  });

  it("falls back to UNKNOWN_TRANSIENT rather than guessing at an unrecognised reason", () => {
    expect(
      classifyDiagnosis({ leakClass: "PAYMENT_BLOCKED", errorReason: "some_new_bank_specific_code" }),
    ).toBe("UNKNOWN_TRANSIENT");
  });

  it("falls back to UNKNOWN_TRANSIENT when there's no error information at all", () => {
    expect(classifyDiagnosis({ leakClass: "PAYMENT_BLOCKED" })).toBe("UNKNOWN_TRANSIENT");
  });
});
