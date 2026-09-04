/**
 * The six leak classes from the PRD (§5). Four are classified here — a
 * checkout is in exactly one of these states, so this is one classifier
 * with named internal rules, not four independent detector modules pretending
 * to be unrelated. `METHOD_CONCENTRATION` (needs a 14-day baseline across
 * checkouts, not a single checkout's timeline) and `POST_PURCHASE_LEAK`
 * (needs a refund/return model that doesn't exist yet) aren't classified
 * here — see LEARNINGS.md.
 */
export type LeakClass =
  | "PAYMENT_BLOCKED"
  | "ISSUER_DOWNTIME"
  | "SILENT_ABANDON"
  | "PRE_CHECKOUT_DROP"
  | "METHOD_CONCENTRATION"
  | "POST_PURCHASE_LEAK";

export type FunnelEventFact = {
  id: string;
  stage: string;
  occurredAt: Date;
  amountPaise: bigint;
};

export type PaymentAttemptFact = {
  id: string;
  status: string;
  method: string;
  attemptedAt: Date;
  amountPaise: bigint;
};

export type DowntimeWindowFact = {
  method: string;
  startedAt: Date;
  resolvedAt: Date | null;
};

export type CheckoutTimeline = {
  checkoutId: string;
  funnelEvents: FunnelEventFact[];
  paymentAttempts: PaymentAttemptFact[];
};

export type LeakCandidate = {
  class: LeakClass;
  checkoutId: string;
  amountPaise: bigint;
  evidenceEventIds: string[];
  confidence: number;
};

function overlapsDowntime(attempt: PaymentAttemptFact, windows: DowntimeWindowFact[]): boolean {
  return windows.some(
    (window) =>
      window.method === attempt.method &&
      attempt.attemptedAt >= window.startedAt &&
      (window.resolvedAt === null || attempt.attemptedAt <= window.resolvedAt),
  );
}

/**
 * Classifies one checkout's timeline into at most one leak. No evidence,
 * no leak — every return path carries at least one real event id, and
 * classify-checkout.test.ts asserts that directly rather than trusting it.
 */
export function classifyCheckout(
  timeline: CheckoutTimeline,
  downtimeWindows: DowntimeWindowFact[] = [],
): LeakCandidate | null {
  const { checkoutId, funnelEvents, paymentAttempts } = timeline;
  const checkoutStart = funnelEvents.find((e) => e.stage === "checkout_start");
  const addToCart = funnelEvents.find((e) => e.stage === "add_to_cart");

  const succeeded = paymentAttempts.some((a) => a.status === "captured");
  const failed = paymentAttempts.filter((a) => a.status === "failed");

  if (failed.length > 0 && !succeeded) {
    const evidenceEventIds = [...(checkoutStart ? [checkoutStart.id] : []), ...failed.map((a) => a.id)];
    const isDowntime = failed.some((a) => overlapsDowntime(a, downtimeWindows));
    return {
      class: isDowntime ? "ISSUER_DOWNTIME" : "PAYMENT_BLOCKED",
      checkoutId,
      amountPaise: failed[0]!.amountPaise,
      evidenceEventIds,
      confidence: 1,
    };
  }

  if (checkoutStart && paymentAttempts.length === 0) {
    return {
      class: "SILENT_ABANDON",
      checkoutId,
      amountPaise: checkoutStart.amountPaise,
      evidenceEventIds: [checkoutStart.id],
      confidence: 1,
    };
  }

  if (addToCart && !checkoutStart) {
    return {
      class: "PRE_CHECKOUT_DROP",
      checkoutId,
      amountPaise: addToCart.amountPaise,
      evidenceEventIds: [addToCart.id],
      confidence: 1,
    };
  }

  return null;
}
