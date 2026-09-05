import { describe, expect, it } from "vitest";
import { buildDigestNarrative, type DigestData } from "./build-narrative.js";

function data(overrides: Partial<DigestData> = {}): DigestData {
  return {
    periodStart: "2026-08-28",
    periodEnd: "2026-09-04",
    leaksDetected: 0,
    leaksByClass: [],
    totalLeakAmountPaise: 0n,
    actionsDispatched: 0,
    actionsBlocked: 0,
    netRecoveredPaise: 0n,
    shieldBlockReasons: [],
    ...overrides,
  };
}

describe("buildDigestNarrative — the founder brief, templated (no live model configured)", () => {
  it("says plainly when nothing happened, rather than forcing a paragraph out of zeros", () => {
    const text = buildDigestNarrative(data());
    expect(text).toContain("No leaks");
  });

  it("names the two biggest leak classes and their counts", () => {
    const text = buildDigestNarrative(
      data({
        leaksDetected: 18,
        totalLeakAmountPaise: 250_000n,
        leaksByClass: [
          { class: "PAYMENT_BLOCKED", count: 10, amountPaise: 150_000n },
          { class: "SILENT_ABANDON", count: 8, amountPaise: 100_000n },
        ],
      }),
    );
    expect(text).toContain("18 leaks");
    expect(text).toContain("₹2,500.00");
    expect(text).toMatch(/payment.blocked/i);
    expect(text).toMatch(/silent.abandon/i);
  });

  it("reports dispatched actions and predicted recovery, calling it predicted explicitly", () => {
    const text = buildDigestNarrative(
      data({
        leaksDetected: 5,
        totalLeakAmountPaise: 50_000n,
        leaksByClass: [{ class: "PAYMENT_BLOCKED", count: 5, amountPaise: 50_000n }],
        actionsDispatched: 3,
        netRecoveredPaise: 12_000n,
      }),
    );
    expect(text).toContain("3 recovery message");
    expect(text).toContain("₹120.00");
    expect(text.toLowerCase()).toContain("predicted");
  });

  it("names the top Shield block reason when actions were blocked", () => {
    const text = buildDigestNarrative(
      data({
        leaksDetected: 2,
        totalLeakAmountPaise: 20_000n,
        leaksByClass: [{ class: "PAYMENT_BLOCKED", count: 2, amountPaise: 20_000n }],
        actionsBlocked: 4,
        shieldBlockReasons: [
          { reason: "quiet hours", count: 3 },
          { reason: "opted out", count: 1 },
        ],
      }),
    );
    expect(text).toContain("4 actions");
    expect(text).toContain("quiet hours");
  });

  it("says '1 action', not '1 actions', when exactly one was blocked", () => {
    const text = buildDigestNarrative(
      data({
        leaksDetected: 1,
        totalLeakAmountPaise: 10_000n,
        leaksByClass: [{ class: "PAYMENT_BLOCKED", count: 1, amountPaise: 10_000n }],
        actionsBlocked: 1,
        shieldBlockReasons: [{ reason: "amount below the ₹200 recovery floor", count: 1 }],
      }),
    );
    expect(text).toContain("1 action,");
    expect(text).not.toContain("1 actions");
  });

  it("never contains a raw unformatted paise number where a rupee figure belongs", () => {
    const text = buildDigestNarrative(
      data({
        leaksDetected: 1,
        totalLeakAmountPaise: 123_456n,
        leaksByClass: [{ class: "PAYMENT_BLOCKED", count: 1, amountPaise: 123_456n }],
      }),
    );
    expect(text).not.toMatch(/123456/);
  });
});
