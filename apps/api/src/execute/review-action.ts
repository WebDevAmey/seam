import { prisma } from "../prisma.js";
import { appendLedgerEntry } from "../ledger/append.js";

async function loadOwnPendingAction(recoveryActionId: string, merchantId: string) {
  const action = await prisma.recoveryAction.findUnique({ where: { id: recoveryActionId } });
  if (!action || action.merchantId !== merchantId) {
    throw new Error("recovery action not found");
  }
  if (action.state !== "RESERVED") {
    throw new Error(`recovery action is not pending review (state: ${action.state})`);
  }
  return action;
}

/**
 * The real, fully working half of "review a pending action": no external
 * credentials needed, so unlike approve below, this one genuinely
 * completes. Marks the reservation FAILED (not DISPATCHED — the partial
 * unique index in manual-constraints.sql only covers RESERVED/DISPATCHED,
 * so a FAILED row correctly stops blocking a fresh retry later) and
 * records the human's own reason on the ledger, not a synthesized one.
 */
export async function rejectAction(
  recoveryActionId: string,
  merchantId: string,
  reason?: string,
): Promise<{ outcome: "rejected" }> {
  const action = await loadOwnPendingAction(recoveryActionId, merchantId);

  await prisma.recoveryAction.update({ where: { id: action.id }, data: { state: "FAILED" } });
  await appendLedgerEntry({
    merchantId,
    payload: {
      type: "action_rejected",
      actionId: action.id,
      leakId: action.leakId,
      checkoutId: action.checkoutId,
      reason: reason ?? "declined by founder",
    },
  });

  return { outcome: "rejected" };
}

/**
 * The honest half. Approving a held action means actually dispatching it —
 * a real Razorpay payment link, sent to the real customer — which needs
 * the merchant's own connected Razorpay credentials
 * (`merchants/routes.ts`'s `/razorpay/connect`). Nothing in this build has
 * one configured (LIMITATIONS.md §10), and `RecoveryAction` doesn't retain
 * enough to complete a dispatch later anyway (no stored customerPhone or
 * amountPaise — see the same section). Rather than fake success or throw
 * an opaque error, this reports that real, specific fact and changes
 * nothing, so a later real approval flow can still act on the action.
 */
export async function approveAction(
  recoveryActionId: string,
  merchantId: string,
): Promise<{ outcome: "not_connected" } | { outcome: "dispatched" }> {
  await loadOwnPendingAction(recoveryActionId, merchantId);

  const connection = await prisma.razorpayConnection.findUnique({ where: { merchantId } });
  if (!connection || connection.status !== "CONNECTED") {
    return { outcome: "not_connected" };
  }

  // No merchant in this build reaches here yet — see the disclosure above.
  throw new Error("approving a connected merchant's action isn't implemented yet");
}
