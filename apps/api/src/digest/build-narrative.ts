export type DigestData = {
  periodStart: string;
  periodEnd: string;
  leaksDetected: number;
  leaksByClass: { class: string; count: number; amountPaise: bigint }[];
  totalLeakAmountPaise: bigint;
  actionsDispatched: number;
  actionsBlocked: number;
  /** EV of dispatched actions — predicted, not observed. See LIMITATIONS.md
   * §2: there's no outcome worker, so this is never claimed as realised. */
  netRecoveredPaise: bigint;
  shieldBlockReasons: { reason: string; count: number }[];
};

const rupeeFormatter = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });

function formatPaise(paise: bigint): string {
  return rupeeFormatter.format(Number(paise) / 100);
}

const LEAK_CLASS_LABELS: Record<string, string> = {
  PAYMENT_BLOCKED: "payment-blocked",
  ISSUER_DOWNTIME: "issuer-downtime",
  SILENT_ABANDON: "silent-abandon",
  PRE_CHECKOUT_DROP: "pre-checkout-drop",
  METHOD_CONCENTRATION: "method-concentration",
  POST_PURCHASE_LEAK: "post-purchase",
};

function labelFor(leakClass: string): string {
  return LEAK_CLASS_LABELS[leakClass] ?? leakClass.toLowerCase();
}

/**
 * The founder brief, generalized from a per-leak paragraph to a period
 * summary — templated, not model-generated (no OpenAI key configured for
 * this project; see LIMITATIONS.md §4). Every number here is real, pulled
 * from Seam's own data, not fabricated for the sake of having a paragraph.
 */
export function buildDigestNarrative(data: DigestData): string {
  if (data.leaksDetected === 0) {
    return `No leaks detected between ${data.periodStart} and ${data.periodEnd}.`;
  }

  const sortedClasses = [...data.leaksByClass].sort((a, b) => b.amountPaise - a.amountPaise > 0n ? 1 : -1);
  const topTwo = sortedClasses.slice(0, 2).map((c) => `${labelFor(c.class)} (${c.count})`);
  const classSummary = topTwo.length > 0 ? `, mostly ${topTwo.join(" and ")}` : "";

  const leakWord = data.leaksDetected === 1 ? "leak" : "leaks";
  const sentences = [
    `Between ${data.periodStart} and ${data.periodEnd}, Seam found ${formatPaise(data.totalLeakAmountPaise)} across ${data.leaksDetected} ${leakWord}${classSummary}.`,
  ];

  if (data.actionsDispatched > 0) {
    sentences.push(
      `${data.actionsDispatched} recovery message${data.actionsDispatched === 1 ? "" : "s"} went out, a predicted ${formatPaise(data.netRecoveredPaise)} recovered.`,
    );
  }

  if (data.actionsBlocked > 0) {
    const topReason = [...data.shieldBlockReasons].sort((a, b) => b.count - a.count)[0];
    const reasonClause = topReason ? `, most often because of ${topReason.reason}` : "";
    const actionWord = data.actionsBlocked === 1 ? "action" : "actions";
    sentences.push(`Shield blocked ${data.actionsBlocked} ${actionWord}${reasonClause}.`);
  }

  return sentences.join(" ");
}
