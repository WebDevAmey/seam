import type { PaymentForJoin } from "../join/resolve.js";

type RazorpayPaymentEntity = {
  id?: string;
  order_id?: string;
  email?: string;
  contact?: string;
  amount?: number;
  created_at?: number;
  notes?: Record<string, unknown>;
};

/** Pulls the fields `resolveJoin` needs out of a raw `payment.*` webhook
 * payload. Returns null for anything that isn't a recognisable payment
 * event — the caller skips those rather than guessing. */
export function extractPaymentForJoin(rawPayload: unknown): PaymentForJoin | null {
  const entity = (rawPayload as { payload?: { payment?: { entity?: RazorpayPaymentEntity } } })
    ?.payload?.payment?.entity;

  if (!entity || typeof entity.amount !== "number" || typeof entity.created_at !== "number") {
    return null;
  }

  const notesCheckoutId = entity.notes?.["checkout_id"];

  return {
    notesCheckoutId: typeof notesCheckoutId === "string" ? notesCheckoutId : null,
    email: entity.email ?? null,
    phone: entity.contact ?? null,
    amountPaise: BigInt(entity.amount),
    attemptedAt: new Date(entity.created_at * 1000),
  };
}
