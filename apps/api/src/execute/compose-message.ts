/**
 * The trust boundary lives here (PRD §1, §7): no amount, link, or deadline
 * is ever authored into this phrasing — Shield's content validator checks
 * exactly this text, before `composeMessage` appends the one real,
 * database-sourced link. These are fixed templates today; the LangGraph
 * diagnosis subgraph (Block 7, not built yet) is what will draft phrasing
 * like this dynamically — the boundary is the same either way: whatever
 * authors this text, it never touches the link or the amount.
 */
const PHRASING: Record<"DELAYED_RETRY_LINK" | "ALTERNATE_METHOD_LINK" | "SAME_METHOD_LINK", string> = {
  DELAYED_RETRY_LINK:
    "Hi! We noticed your recent order didn't go through. You can complete it whenever you're ready. Here's a link:",
  ALTERNATE_METHOD_LINK:
    "Hi! Your payment method didn't work for this order. You can try a different method here:",
  SAME_METHOD_LINK: "Hi! Your order needs one more step to complete. Continue here:",
};

export function phrasingFor(actionClass: keyof typeof PHRASING): string {
  return PHRASING[actionClass];
}

export function composeMessage(actionClass: keyof typeof PHRASING, paymentLinkUrl: string): string {
  return `${phrasingFor(actionClass)} ${paymentLinkUrl}`;
}
