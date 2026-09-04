import { normaliseEmail, normalisePhone } from "./normalise.js";

export type CheckoutCandidate = {
  checkoutId: string;
  customerEmail: string | null;
  customerPhone: string | null;
  amountPaise: bigint;
  occurredAt: Date;
};

export type PaymentForJoin = {
  /** Present when the merchant's checkout stamped Razorpay's `notes` field
   * with the checkout id — the deterministic join, confidence 1.0. */
  notesCheckoutId?: string | null;
  email: string | null;
  phone: string | null;
  amountPaise: bigint;
  attemptedAt: Date;
};

export type JoinResult =
  | { method: "notes"; checkoutId: string; confidence: 1 }
  | { method: "fuzzy"; checkoutId: string; confidence: number; ambiguous: boolean }
  | { method: "none"; checkoutId: null; confidence: 0 };

const WEIGHTS = { email: 0.4, phone: 0.35, amount: 0.15, timestamp: 0.1 };
const TIME_WINDOW_MS = 90_000;
const ACCEPT_THRESHOLD = 0.75;
const AMBIGUOUS_FLOOR = 0.5;

function scoreCandidate(payment: PaymentForJoin, candidate: CheckoutCandidate): number {
  let score = 0;

  if (
    payment.email &&
    candidate.customerEmail &&
    normaliseEmail(payment.email) === normaliseEmail(candidate.customerEmail)
  ) {
    score += WEIGHTS.email;
  }

  if (
    payment.phone &&
    candidate.customerPhone &&
    normalisePhone(payment.phone) === normalisePhone(candidate.customerPhone)
  ) {
    score += WEIGHTS.phone;
  }

  if (payment.amountPaise === candidate.amountPaise) {
    score += WEIGHTS.amount;
  }

  const deltaMs = Math.abs(payment.attemptedAt.getTime() - candidate.occurredAt.getTime());
  if (deltaMs <= TIME_WINDOW_MS) {
    score += WEIGHTS.timestamp;
  }

  // floating point dust guard: 0.4 + 0.35 can print as 0.7499999999999999
  return Math.round(score * 100) / 100;
}

/**
 * Primary join: trust Razorpay's `notes.checkout_id` when it's there —
 * confidence 1.0, no scoring needed. Fallback: score every candidate on
 * email/phone/amount/timestamp (PRD §4.2 weights) and take the best.
 * Below 0.50, no join. 0.50–0.75, a join exists but is flagged ambiguous —
 * report it, never act on it. ≥0.75, accept it.
 */
export function resolveJoin(
  payment: PaymentForJoin,
  candidates: CheckoutCandidate[],
): JoinResult {
  if (payment.notesCheckoutId) {
    return { method: "notes", checkoutId: payment.notesCheckoutId, confidence: 1 };
  }

  let best: { checkoutId: string; confidence: number } | null = null;
  for (const candidate of candidates) {
    const confidence = scoreCandidate(payment, candidate);
    if (!best || confidence > best.confidence) {
      best = { checkoutId: candidate.checkoutId, confidence };
    }
  }

  if (!best || best.confidence < AMBIGUOUS_FLOOR) {
    return { method: "none", checkoutId: null, confidence: 0 };
  }

  return {
    method: "fuzzy",
    checkoutId: best.checkoutId,
    confidence: best.confidence,
    ambiguous: best.confidence < ACCEPT_THRESHOLD,
  };
}
