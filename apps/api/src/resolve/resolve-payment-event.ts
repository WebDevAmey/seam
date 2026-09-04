import type { Prisma } from "@prisma/client";
import type { ClaimedRawEvent } from "../ingest/claim.js";
import { resolveJoin } from "../join/resolve.js";
import { prisma } from "../prisma.js";
import { fetchCheckoutCandidates } from "./candidates.js";
import { extractPaymentForJoin } from "./extract-payment.js";

type RazorpayPaymentEntity = {
  id?: string;
  order_id?: string;
  method?: string;
  status?: string;
  amount?: number;
  error_code?: string;
  error_description?: string;
  error_source?: string;
  error_step?: string;
  error_reason?: string;
};

/**
 * Turns a claimed `payment.*` RawEvent into a joined PaymentAttempt: pull
 * the payment's own fields, find the checkout it belongs to (notes join,
 * else the scored fallback against recent checkout_start events), write
 * both together. Not a payment event this understands → no-op, not an
 * error — the caller just marks it processed and moves on.
 */
export async function resolvePaymentEvent(event: ClaimedRawEvent): Promise<void> {
  const entity = (event.payload as { payload?: { payment?: { entity?: RazorpayPaymentEntity } } })
    ?.payload?.payment?.entity;
  if (!entity?.id || typeof entity.amount !== "number") return;

  const forJoin = extractPaymentForJoin(event.payload);
  const candidates = forJoin ? await fetchCheckoutCandidates(event.merchantId, forJoin.attemptedAt) : [];
  const join = forJoin
    ? resolveJoin(forJoin, candidates)
    : ({ method: "none", checkoutId: null, confidence: 0 } as const);

  const data = {
    merchantId: event.merchantId,
    rzpOrderId: entity.order_id ?? "",
    checkoutId: join.checkoutId,
    joinConfidence: join.confidence,
    joinMethod: join.method,
    method: entity.method ?? "unknown",
    status: entity.status ?? "unknown",
    amountPaise: BigInt(entity.amount),
    errorCode: entity.error_code ?? null,
    errorDescription: entity.error_description ?? null,
    errorSource: entity.error_source ?? null,
    errorStep: entity.error_step ?? null,
    errorReason: entity.error_reason ?? null,
  } satisfies Omit<Prisma.PaymentAttemptCreateInput, "rzpPaymentId">;

  await prisma.paymentAttempt.upsert({
    where: { rzpPaymentId: entity.id },
    create: { rzpPaymentId: entity.id, ...data },
    update: data,
  });
}
