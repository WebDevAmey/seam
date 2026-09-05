import { describe, expect, it } from "vitest";
import { computeDailyRates, detectMethodConcentration, type AttemptFact } from "./method-concentration.js";

function attempt(date: string, method: string, status: "captured" | "failed"): AttemptFact {
  return { method, status, attemptedAt: new Date(`${date}T10:00:00Z`) };
}

describe("computeDailyRates", () => {
  it("buckets attempts by day and method, computing a decline rate", () => {
    const rates = computeDailyRates([
      attempt("2026-09-01", "upi", "failed"),
      attempt("2026-09-01", "upi", "failed"),
      attempt("2026-09-01", "upi", "captured"),
      attempt("2026-09-01", "upi", "captured"),
    ]);
    expect(rates).toEqual([{ date: "2026-09-01", method: "upi", total: 4, declined: 2, rate: 0.5 }]);
  });

  it("keeps methods and days separate", () => {
    const rates = computeDailyRates([
      attempt("2026-09-01", "upi", "failed"),
      attempt("2026-09-01", "card", "captured"),
      attempt("2026-09-02", "upi", "captured"),
    ]);
    expect(rates).toHaveLength(3);
  });
});

describe("detectMethodConcentration — a real 2σ-over-baseline check, not a fixed threshold", () => {
  // Real day-to-day jitter (±0.02 around the target rate, alternating) so
  // the baseline has genuine, non-zero variance — a perfectly flat
  // baseline would make every test here accidentally exercise the
  // zero-stddev edge case (its own dedicated test below) instead of real
  // mean/stddev math.
  function baselineDays(method: string, rate: number, days: number, total = 20): AttemptFact[] {
    const out: AttemptFact[] = [];
    for (let d = 1; d <= days; d++) {
      const date = `2026-08-${String(d).padStart(2, "0")}`;
      const jitter = d % 2 === 0 ? 0.02 : -0.02;
      const declined = Math.round(total * Math.max(0, rate + jitter));
      for (let i = 0; i < declined; i++) out.push(attempt(date, method, "failed"));
      for (let i = 0; i < total - declined; i++) out.push(attempt(date, method, "captured"));
    }
    return out;
  }

  it("flags a method whose today's decline rate is more than 2 standard deviations above its baseline", () => {
    // ~10 days around a 10% decline rate (with real jitter), then today spikes to 80%.
    const attempts = [
      ...baselineDays("upi", 0.1, 10),
      ...Array.from({ length: 16 }, () => attempt("2026-09-04", "upi", "failed")),
      ...Array.from({ length: 4 }, () => attempt("2026-09-04", "upi", "captured")),
    ];
    const rates = computeDailyRates(attempts);
    const findings = detectMethodConcentration(rates, "2026-09-04");

    expect(findings).toHaveLength(1);
    expect(findings[0]?.method).toBe("upi");
    expect(findings[0]?.baselineStdDev).toBeGreaterThan(0); // confirms this exercised real variance, not the edge case
    expect(findings[0]?.zScore).toBeGreaterThan(2);
  });

  it("does not flag a method whose rate today is within normal variance", () => {
    const attempts = [
      ...baselineDays("card", 0.15, 10),
      ...Array.from({ length: 3 }, () => attempt("2026-09-04", "card", "failed")),
      ...Array.from({ length: 17 }, () => attempt("2026-09-04", "card", "captured")),
    ];
    const rates = computeDailyRates(attempts);
    const findings = detectMethodConcentration(rates, "2026-09-04");
    expect(findings).toHaveLength(0);
  });

  it("does not flag a method with fewer than 7 days of baseline history — not enough to trust a mean/stddev from", () => {
    const attempts = [
      ...baselineDays("wallet", 0.1, 3),
      ...Array.from({ length: 16 }, () => attempt("2026-09-04", "wallet", "failed")),
      ...Array.from({ length: 4 }, () => attempt("2026-09-04", "wallet", "captured")),
    ];
    const rates = computeDailyRates(attempts);
    const findings = detectMethodConcentration(rates, "2026-09-04");
    expect(findings).toHaveLength(0);
  });

  it("does not flag a method with fewer than 5 attempts today — too small a sample to act on", () => {
    const attempts = [
      ...baselineDays("netbanking", 0.1, 10),
      ...Array.from({ length: 3 }, () => attempt("2026-09-04", "netbanking", "failed")),
    ];
    const rates = computeDailyRates(attempts);
    const findings = detectMethodConcentration(rates, "2026-09-04");
    expect(findings).toHaveLength(0);
  });

  it("a method with zero variance in its baseline (always 0% decline) doesn't divide by zero", () => {
    const attempts = [
      ...baselineDays("upi", 0, 10),
      ...Array.from({ length: 10 }, () => attempt("2026-09-04", "upi", "failed")),
    ];
    const rates = computeDailyRates(attempts);
    expect(() => detectMethodConcentration(rates, "2026-09-04")).not.toThrow();
    const findings = detectMethodConcentration(rates, "2026-09-04");
    expect(findings).toHaveLength(1); // any decline at all is infinitely above a zero-variance, zero-mean baseline
  });
});
