/**
 * There's no login/session auth in this build — deliberately deferred (see
 * PRD §16 open questions). Every screen renders one hardcoded merchant.
 * Swapping this for a real session-derived merchant id later touches this
 * one function, not every page.
 */
export function requireDemoMerchantId(): string {
  const id = process.env.SEAM_DEMO_MERCHANT_ID;
  if (!id) throw new Error("SEAM_DEMO_MERCHANT_ID is not set");
  return id;
}
