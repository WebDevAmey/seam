import { prisma } from "../prisma.js";
import type { ChannelAdapter } from "./channel-adapter.js";
import { composeMessage, phrasingFor } from "./compose-message.js";
import { createPaymentLink } from "./razorpay-payment-link.js";
import { reserveAction } from "./reserve-action.js";
import { appendLedgerEntry } from "../ledger/append.js";
import { evaluateShield } from "../shield/evaluate.js";

export type DispatchableActionClass = "DELAYED_RETRY_LINK" | "ALTERNATE_METHOD_LINK" | "SAME_METHOD_LINK";
export type ActionClass = DispatchableActionClass | "HOLD_AND_ESCALATE";

export type ExecuteInput = {
  merchantId: string;
  checkoutId: string;
  leakId: string;
  actionClass: ActionClass;
  evPaise: bigint;
  amountPaise: bigint;
  channel: "sms" | "whatsapp";
  customerPhone: string;
  razorpayKeyId: string;
  razorpayKeySecret: string;
  adapter: ChannelAdapter;
  shieldContext: {
    optedOut: boolean;
    now: Date;
    contactsInLast7Days: number;
    merchantContactsToday: number;
    merchantDailyOutreachCap: number;
    autoApproveThresholdPaise: bigint;
  };
};

export type ExecuteOutcome =
  | { outcome: "dispatched"; actionId: string; providerRef: string }
  | { outcome: "needs_approval"; actionId: string; reason: string }
  | { outcome: "blocked"; reason: string }
  | { outcome: "already_reserved" };

/**
 * Ties Policy's decision through to a real, recorded outcome:
 *   Shield (stateless checks) → reserve (the idempotency lock, PRD §9 check
 *   6 — positioned here, after the cheap checks, before any real work) →
 *   dispatch → record, with every terminal state written to the ledger.
 * HOLD_AND_ESCALATE never reaches Shield or a customer at all.
 */
export async function executeAction(input: ExecuteInput): Promise<ExecuteOutcome> {
  if (input.actionClass === "HOLD_AND_ESCALATE") {
    const reservation = await reserveAction({
      merchantId: input.merchantId,
      checkoutId: input.checkoutId,
      leakId: input.leakId,
      actionClass: input.actionClass,
      evPaise: 0n,
      shieldVerdict: "N/A",
    });
    if (!reservation.reserved) return { outcome: "already_reserved" };

    await appendLedgerEntry({
      merchantId: input.merchantId,
      payload: { type: "action_escalated", actionId: reservation.actionId, leakId: input.leakId, checkoutId: input.checkoutId },
    });
    return { outcome: "dispatched", actionId: reservation.actionId, providerRef: "internal-escalation" };
  }

  const phrasing = phrasingFor(input.actionClass);
  const verdict = evaluateShield({
    optedOut: input.shieldContext.optedOut,
    now: input.shieldContext.now,
    contactsInLast7Days: input.shieldContext.contactsInLast7Days,
    amountPaise: input.amountPaise,
    merchantContactsToday: input.shieldContext.merchantContactsToday,
    merchantDailyOutreachCap: input.shieldContext.merchantDailyOutreachCap,
    messageText: phrasing,
    evPaise: input.evPaise,
    autoApproveThresholdPaise: input.shieldContext.autoApproveThresholdPaise,
  });

  if (verdict.verdict === "BLOCK") {
    await appendLedgerEntry({
      merchantId: input.merchantId,
      payload: {
        type: "action_blocked",
        leakId: input.leakId,
        checkoutId: input.checkoutId,
        actionClass: input.actionClass,
        reason: verdict.reason,
      },
    });
    return { outcome: "blocked", reason: verdict.reason };
  }

  const reservation = await reserveAction({
    merchantId: input.merchantId,
    checkoutId: input.checkoutId,
    leakId: input.leakId,
    actionClass: input.actionClass,
    evPaise: input.evPaise,
    shieldVerdict: verdict.verdict,
    shieldReason: verdict.verdict === "NEEDS_APPROVAL" ? verdict.reason : null,
  });
  if (!reservation.reserved) return { outcome: "already_reserved" };

  if (verdict.verdict === "NEEDS_APPROVAL") {
    await appendLedgerEntry({
      merchantId: input.merchantId,
      payload: { type: "action_needs_approval", actionId: reservation.actionId, leakId: input.leakId, reason: verdict.reason },
    });
    return { outcome: "needs_approval", actionId: reservation.actionId, reason: verdict.reason };
  }

  try {
    const link = await createPaymentLink({
      keyId: input.razorpayKeyId,
      keySecret: input.razorpayKeySecret,
      amountPaise: input.amountPaise,
      checkoutId: input.checkoutId,
      customerPhone: input.customerPhone,
      description: "Complete your order",
    });

    const message = composeMessage(input.actionClass, link.shortUrl);
    const sendResult = await input.adapter.send({ to: input.customerPhone, text: message });

    if (!sendResult.sent) {
      await prisma.recoveryAction.update({ where: { id: reservation.actionId }, data: { state: "FAILED" } });
      await appendLedgerEntry({
        merchantId: input.merchantId,
        payload: { type: "action_failed", actionId: reservation.actionId, reason: sendResult.error },
      });
      return { outcome: "blocked", reason: sendResult.error };
    }

    await prisma.recoveryAction.update({
      where: { id: reservation.actionId },
      data: { state: "DISPATCHED", rzpRef: link.id, dispatchedAt: new Date() },
    });
    await appendLedgerEntry({
      merchantId: input.merchantId,
      payload: {
        type: "action_dispatched",
        actionId: reservation.actionId,
        leakId: input.leakId,
        checkoutId: input.checkoutId,
        actionClass: input.actionClass,
        channel: input.channel,
        providerRef: sendResult.providerRef,
        rzpRef: link.id,
      },
    });
    return { outcome: "dispatched", actionId: reservation.actionId, providerRef: sendResult.providerRef };
  } catch (error) {
    // A definitive failure releases the reservation's exclusivity (FAILED
    // isn't covered by the partial unique index) so a legitimate retry
    // later isn't blocked forever by this attempt.
    await prisma.recoveryAction.update({ where: { id: reservation.actionId }, data: { state: "FAILED" } });
    await appendLedgerEntry({
      merchantId: input.merchantId,
      payload: {
        type: "action_failed",
        actionId: reservation.actionId,
        reason: error instanceof Error ? error.message : "unknown error",
      },
    });
    throw error;
  }
}
