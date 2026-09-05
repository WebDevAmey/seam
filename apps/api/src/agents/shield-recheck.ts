import { phrasingFor } from "../execute/compose-message.js";
import { prisma } from "../prisma.js";
import { evaluateShield } from "../shield/evaluate.js";

export type ShieldRunResult = { checked: number; stillPass: number; nowBlocked: number };

/**
 * A recheck, not a re-run of the full seven-check surface Shield's own
 * description names: `RecoveryAction` doesn't retain a customer contact
 * (LIMITATIONS.md §13), so opt-out status and the 7-day contact count can't
 * be recomputed per action from this table alone — those default to their
 * most permissive values here, disclosed rather than faked as "still
 * checked." What genuinely re-runs, against currently-live data: the
 * quiet-hours check (depends only on the current time) and the EV floor
 * (depends only on the leak's own stored `evPaise`) — real drift Shield
 * would have caught on a real dispatch. Read-only: a pending action that
 * would now be blocked is reported, never silently failed on this agent's
 * own initiative — a human still decides via the recovery queue.
 */
export async function runShieldRecheck(merchantId: string, now: Date = new Date()): Promise<ShieldRunResult> {
  const pending = await prisma.recoveryAction.findMany({
    where: { merchantId, state: "RESERVED", actionClass: { not: "HOLD_AND_ESCALATE" } },
  });
  const leaks = await prisma.leak.findMany({ where: { id: { in: pending.map((a) => a.leakId) } } });
  const leakById = new Map(leaks.map((l) => [l.id, l]));

  let stillPass = 0;
  let nowBlocked = 0;

  for (const action of pending) {
    const leak = leakById.get(action.leakId);
    if (!leak) continue;
    const verdict = evaluateShield({
      optedOut: false,
      now,
      contactsInLast7Days: 0,
      amountPaise: leak.amountPaise,
      merchantContactsToday: 0,
      merchantDailyOutreachCap: 1000,
      messageText: phrasingFor(action.actionClass as "DELAYED_RETRY_LINK" | "ALTERNATE_METHOD_LINK" | "SAME_METHOD_LINK"),
      evPaise: action.evPaise,
      autoApproveThresholdPaise: 150_000n,
    });
    if (verdict.verdict === "BLOCK") nowBlocked++;
    else stillPass++;
  }

  return { checked: pending.length, stillPass, nowBlocked };
}
