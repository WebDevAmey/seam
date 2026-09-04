import { describe, expect, it } from "vitest";
import { type CheckoutCandidate, type PaymentForJoin, resolveJoin } from "./resolve.js";

const BASE_TIME = new Date("2026-09-04T10:00:00Z");

function candidate(overrides: Partial<CheckoutCandidate> = {}): CheckoutCandidate {
  return {
    checkoutId: "checkout_1",
    customerEmail: "buyer@example.com",
    customerPhone: "+919876543210",
    amountPaise: 1_000_00n,
    occurredAt: BASE_TIME,
    ...overrides,
  };
}

function payment(overrides: Partial<PaymentForJoin> = {}): PaymentForJoin {
  return {
    notesCheckoutId: null,
    email: "buyer@example.com",
    phone: "+919876543210",
    amountPaise: 1_000_00n,
    attemptedAt: BASE_TIME,
    ...overrides,
  };
}

describe("resolveJoin — the notes join (confidence 1.0, deterministic)", () => {
  it("trusts notes.checkout_id immediately and never scores candidates", () => {
    const result = resolveJoin(
      payment({ notesCheckoutId: "checkout_from_notes" }),
      [candidate({ checkoutId: "some_other_checkout", amountPaise: 999_99n })], // would score badly
    );
    expect(result).toEqual({ method: "notes", checkoutId: "checkout_from_notes", confidence: 1 });
  });
});

describe("resolveJoin — the scored fallback (PRD §4.2 weights: email .40, phone .35, amount .15, timestamp .10)", () => {
  it("scores 1.0 when every signal matches", () => {
    const result = resolveJoin(payment(), [candidate()]);
    expect(result).toEqual({
      method: "fuzzy",
      checkoutId: "checkout_1",
      confidence: 1,
      ambiguous: false,
    });
  });

  it("accepts a join right at the 0.75 boundary (email + phone)", () => {
    const result = resolveJoin(
      payment({ amountPaise: 555_00n, attemptedAt: new Date(BASE_TIME.getTime() + 999_999) }),
      [candidate()],
    );
    expect(result.method).toBe("fuzzy");
    expect(result.confidence).toBe(0.75);
    expect((result as { ambiguous: boolean }).ambiguous).toBe(false);
  });

  it("marks a mid-range score (email + amount = 0.55) as ambiguous, not actionable", () => {
    const result = resolveJoin(
      payment({ phone: "+911111111111", attemptedAt: new Date(BASE_TIME.getTime() + 999_999) }),
      [candidate()],
    );
    expect(result.confidence).toBe(0.55);
    expect((result as { ambiguous: boolean }).ambiguous).toBe(true);
  });

  it("returns no join below 0.50 (amount + timestamp only = 0.25)", () => {
    const result = resolveJoin(
      payment({ email: "nobody@else.com", phone: "+911111111111" }),
      [candidate()],
    );
    expect(result).toEqual({ method: "none", checkoutId: null, confidence: 0 });
  });

  it("picks the best-scoring candidate when several are plausible", () => {
    const weak = candidate({ checkoutId: "weak", customerPhone: "+911111111111" }); // email only = 0.40
    const strong = candidate({ checkoutId: "strong" }); // everything = 1.0
    const result = resolveJoin(payment(), [weak, strong]);
    expect(result.checkoutId).toBe("strong");
  });

  it("returns no join when there are no candidates at all", () => {
    expect(resolveJoin(payment(), [])).toEqual({ method: "none", checkoutId: null, confidence: 0 });
  });

  it("matches through email/phone normalisation, not raw string equality", () => {
    const result = resolveJoin(
      payment({ email: "B.U.Y.E.R@gmail.com", phone: "09876543210" }),
      [candidate({ customerEmail: "buyer@gmail.com", customerPhone: "+919876543210" })],
    );
    expect(result.confidence).toBeGreaterThanOrEqual(0.75);
  });

  it("treats a timestamp more than 90s away as not matching", () => {
    const result = resolveJoin(
      payment({ attemptedAt: new Date(BASE_TIME.getTime() + 91_000) }),
      [candidate()],
    );
    // email .40 + phone .35 + amount .15 = 0.90, timestamp signal excluded
    expect(result.confidence).toBe(0.9);
  });
});
