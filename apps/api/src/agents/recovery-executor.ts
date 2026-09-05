import { classifyDiagnosis, type DiagnosisClass } from "../diagnosis/classify-diagnosis.js";
import { phrasingFor } from "../execute/compose-message.js";
import { reserveAction } from "../execute/reserve-action.js";
import { appendLedgerEntry } from "../ledger/append.js";
import { decide } from "../policy/decide.js";
import { prisma } from "../prisma.js";
import { evaluateShield } from "../shield/evaluate.js";

const ACTIONABLE_CLASSES = ["PAYMENT_BLOCKED", "ISSUER_DOWNTIME"];

export type ExecutorRunResult = { reserved: number; blocked: number; noAction: number };

/**
 * The live orchestration LIMITATIONS.md §10 disclosed as missing: this
 * actually wires detect → diagnose → decide → Shield → reserve into one
 * runnable sweep, instead of only ever computing it as a dry run
 * (`opportunities.ts`) or hand-inserting demo rows (`seed-demo.ts`). Reuses
 * a persisted `Diagnosis` row when the Diagnosis Agent has already run for
 * a leak, falling back to the same inline `classifyDiagnosis` call
 * `opportunities.ts` uses otherwise — this agent doesn't require Diagnosis
 * to have run first, but benefits when it has.
 *
 * Blocked leaks are reserved and then immediately marked FAILED, exactly
 * the pattern `execute-action.ts` itself uses when a later step fails —
 * blocked actions stay visible with their real Shield reason (the recovery
 * queue page's own stated principle) rather than leaving no record at all.
 */
export async function runRecoveryExecutor(
  merchantId: string,
  options: { now?: Date; evFloorPaise?: bigint; autoApproveThresholdPaise?: bigint } = {},
): Promise<ExecutorRunResult> {
  const now = options.now ?? new Date();
  const evFloorPaise = options.evFloorPaise ?? 5000n;
  const autoApproveThresholdPaise = options.autoApproveThresholdPaise ?? 150_000n;

  const [leaks, addressedLeakIds, diagnoses, downtimeWindows] = await Promise.all([
    prisma.leak.findMany({ where: { merchantId, class: { in: ACTIONABLE_CLASSES } } }),
    prisma.recoveryAction.findMany({ where: { merchantId }, select: { leakId: true } }),
    prisma.diagnosis.findMany(),
    prisma.downtimeWindow.findMany(),
  ]);
  const addressed = new Set(addressedLeakIds.map((a) => a.leakId));
  const diagnosisByLeak = new Map(diagnoses.map((d) => [d.leakId, d]));
  const unaddressed = leaks.filter((leak) => !addressed.has(leak.id));

  let reserved = 0;
  let blocked = 0;
  let noAction = 0;

  for (const leak of unaddressed) {
    const attempt = leak.checkoutId
      ? await prisma.paymentAttempt.findFirst({ where: { merchantId, checkoutId: leak.checkoutId } })
      : null;

    const existing = diagnosisByLeak.get(leak.id);
    const diagnosisClass = (existing?.diagnosisClass as DiagnosisClass | undefined) ??
      classifyDiagnosis({
        leakClass: leak.class,
        errorCode: attempt?.errorCode ?? null,
        errorReason: attempt?.errorReason ?? null,
        errorSource: attempt?.errorSource ?? null,
        errorStep: attempt?.errorStep ?? null,
      });

    const downtimeResolvedAt =
      diagnosisClass === "ISSUER_DOWNTIME"
        ? (downtimeWindows.find((w) => w.method === attempt?.method)?.resolvedAt ?? null)
        : null;

    const decision = decide({
      leakAmountPaise: leak.amountPaise,
      diagnosisClass,
      channel: "sms",
      contactsInLast7Days: 0,
      evFloorPaise,
      now,
      downtimeResolvedAt,
    });

    if (decision.kind === "no_action") {
      noAction++;
      continue;
    }

    if (decision.action.actionClass === "HOLD_AND_ESCALATE") {
      const r = await reserveAction({
        merchantId,
        checkoutId: leak.checkoutId!,
        leakId: leak.id,
        actionClass: "HOLD_AND_ESCALATE",
        evPaise: 0n,
        shieldVerdict: "N/A",
      });
      if (r.reserved) {
        await appendLedgerEntry({
          merchantId,
          payload: { type: "action_escalated", actionId: r.actionId, leakId: leak.id, checkoutId: leak.checkoutId },
        });
        reserved++;
      }
      continue;
    }

    const verdict = evaluateShield({
      optedOut: false,
      now,
      contactsInLast7Days: 0,
      amountPaise: leak.amountPaise,
      merchantContactsToday: 0,
      merchantDailyOutreachCap: 1000,
      messageText: phrasingFor(decision.action.actionClass),
      evPaise: decision.action.evPaise,
      autoApproveThresholdPaise,
    });

    if (verdict.verdict === "BLOCK") {
      const r = await reserveAction({
        merchantId,
        checkoutId: leak.checkoutId!,
        leakId: leak.id,
        actionClass: decision.action.actionClass,
        evPaise: decision.action.evPaise,
        shieldVerdict: "BLOCK",
        shieldReason: verdict.reason,
      });
      if (r.reserved) {
        await prisma.recoveryAction.update({ where: { id: r.actionId }, data: { state: "FAILED" } });
        await appendLedgerEntry({
          merchantId,
          payload: {
            type: "action_blocked",
            leakId: leak.id,
            checkoutId: leak.checkoutId,
            actionClass: decision.action.actionClass,
            reason: verdict.reason,
          },
        });
        blocked++;
      }
      continue;
    }

    const r = await reserveAction({
      merchantId,
      checkoutId: leak.checkoutId!,
      leakId: leak.id,
      actionClass: decision.action.actionClass,
      evPaise: decision.action.evPaise,
      shieldVerdict: verdict.verdict,
      shieldReason: verdict.verdict === "NEEDS_APPROVAL" ? verdict.reason : null,
    });
    if (r.reserved) {
      await appendLedgerEntry({
        merchantId,
        payload:
          verdict.verdict === "NEEDS_APPROVAL"
            ? { type: "action_needs_approval", actionId: r.actionId, leakId: leak.id, reason: verdict.reason }
            : { type: "action_reserved", actionId: r.actionId, leakId: leak.id, checkoutId: leak.checkoutId, actionClass: decision.action.actionClass },
      });
      reserved++;
    }
  }

  return { reserved, blocked, noAction };
}
