import { describe, expect, it } from "vitest";
import { classifyCheckout, type CheckoutTimeline, type DowntimeWindowFact } from "./classify-checkout.js";

const T0 = new Date("2026-09-04T10:00:00Z");

function timeline(overrides: Partial<CheckoutTimeline>): CheckoutTimeline {
  return { checkoutId: "checkout_1", funnelEvents: [], paymentAttempts: [], ...overrides };
}

describe("classifyCheckout", () => {
  it("returns null for a checkout that succeeded — not a leak", () => {
    const result = classifyCheckout(
      timeline({
        funnelEvents: [{ id: "fe_1", stage: "checkout_start", occurredAt: T0, amountPaise: 1000n }],
        paymentAttempts: [{ id: "pa_1", status: "captured", method: "upi", attemptedAt: T0, amountPaise: 1000n }],
      }),
    );
    expect(result).toBeNull();
  });

  it("PAYMENT_BLOCKED: at least one failed attempt, no success, no downtime overlap", () => {
    const result = classifyCheckout(
      timeline({
        funnelEvents: [{ id: "fe_1", stage: "checkout_start", occurredAt: T0, amountPaise: 1000n }],
        paymentAttempts: [{ id: "pa_1", status: "failed", method: "card", attemptedAt: T0, amountPaise: 1000n }],
      }),
    );
    expect(result?.class).toBe("PAYMENT_BLOCKED");
    expect(result?.amountPaise).toBe(1000n);
    expect(result?.evidenceEventIds).toEqual(["fe_1", "pa_1"]);
  });

  it("does not flag PAYMENT_BLOCKED when a later attempt on the same checkout succeeded", () => {
    const result = classifyCheckout(
      timeline({
        funnelEvents: [{ id: "fe_1", stage: "checkout_start", occurredAt: T0, amountPaise: 1000n }],
        paymentAttempts: [
          { id: "pa_1", status: "failed", method: "card", attemptedAt: T0, amountPaise: 1000n },
          { id: "pa_2", status: "captured", method: "upi", attemptedAt: T0, amountPaise: 1000n },
        ],
      }),
    );
    expect(result).toBeNull();
  });

  it("ISSUER_DOWNTIME: a failed attempt whose method+time overlaps an active downtime window", () => {
    const windows: DowntimeWindowFact[] = [
      { method: "upi", startedAt: T0, resolvedAt: new Date(T0.getTime() + 3_600_000) },
    ];
    const result = classifyCheckout(
      timeline({
        funnelEvents: [{ id: "fe_1", stage: "checkout_start", occurredAt: T0, amountPaise: 2000n }],
        paymentAttempts: [
          { id: "pa_1", status: "failed", method: "upi", attemptedAt: new Date(T0.getTime() + 60_000), amountPaise: 2000n },
        ],
      }),
      windows,
    );
    expect(result?.class).toBe("ISSUER_DOWNTIME");
  });

  it("does not upgrade to ISSUER_DOWNTIME when the window is for a different method", () => {
    const windows: DowntimeWindowFact[] = [{ method: "netbanking", startedAt: T0, resolvedAt: null }];
    const result = classifyCheckout(
      timeline({
        funnelEvents: [{ id: "fe_1", stage: "checkout_start", occurredAt: T0, amountPaise: 2000n }],
        paymentAttempts: [{ id: "pa_1", status: "failed", method: "upi", attemptedAt: T0, amountPaise: 2000n }],
      }),
      windows,
    );
    expect(result?.class).toBe("PAYMENT_BLOCKED");
  });

  it("does not upgrade to ISSUER_DOWNTIME once the window has resolved", () => {
    const windows: DowntimeWindowFact[] = [
      { method: "upi", startedAt: T0, resolvedAt: new Date(T0.getTime() + 60_000) },
    ];
    const result = classifyCheckout(
      timeline({
        funnelEvents: [{ id: "fe_1", stage: "checkout_start", occurredAt: T0, amountPaise: 2000n }],
        paymentAttempts: [
          { id: "pa_1", status: "failed", method: "upi", attemptedAt: new Date(T0.getTime() + 3_600_000), amountPaise: 2000n },
        ],
      }),
      windows,
    );
    expect(result?.class).toBe("PAYMENT_BLOCKED");
  });

  it("SILENT_ABANDON: checkout started, zero payment attempts", () => {
    const result = classifyCheckout(
      timeline({ funnelEvents: [{ id: "fe_1", stage: "checkout_start", occurredAt: T0, amountPaise: 1500n }] }),
    );
    expect(result?.class).toBe("SILENT_ABANDON");
    expect(result?.evidenceEventIds).toEqual(["fe_1"]);
  });

  it("PRE_CHECKOUT_DROP: add-to-cart with no checkout_start at all", () => {
    const result = classifyCheckout(
      timeline({ funnelEvents: [{ id: "fe_1", stage: "add_to_cart", occurredAt: T0, amountPaise: 800n }] }),
    );
    expect(result?.class).toBe("PRE_CHECKOUT_DROP");
    expect(result?.evidenceEventIds).toEqual(["fe_1"]);
  });

  it("every returned leak carries at least one evidence event id — never empty", () => {
    const cases: CheckoutTimeline[] = [
      timeline({
        funnelEvents: [{ id: "fe_1", stage: "checkout_start", occurredAt: T0, amountPaise: 1n }],
        paymentAttempts: [{ id: "pa_1", status: "failed", method: "card", attemptedAt: T0, amountPaise: 1n }],
      }),
      timeline({ funnelEvents: [{ id: "fe_2", stage: "checkout_start", occurredAt: T0, amountPaise: 1n }] }),
      timeline({ funnelEvents: [{ id: "fe_3", stage: "add_to_cart", occurredAt: T0, amountPaise: 1n }] }),
    ];
    for (const c of cases) {
      const result = classifyCheckout(c);
      expect(result).not.toBeNull();
      expect(result!.evidenceEventIds.length).toBeGreaterThan(0);
    }
  });
});
