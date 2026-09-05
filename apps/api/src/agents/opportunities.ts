import { classifyDiagnosis, type DiagnosisClass } from "../diagnosis/classify-diagnosis.js";
import { phrasingFor } from "../execute/compose-message.js";
import { decide, type ActionClass } from "../policy/decide.js";
import { prisma } from "../prisma.js";
import { evaluateShield } from "../shield/evaluate.js";

// Only these two are wired to a diagnosis (classifyDiagnosis needs a
// declined *payment* to read error fields from, or the detector's own
// ISSUER_DOWNTIME finding) — Policy has no action mapping for
// SILENT_ABANDON/PRE_CHECKOUT_DROP yet (see EVALUATION.md, LEARNINGS.md).
const ACTIONABLE_CLASSES = ["PAYMENT_BLOCKED", "ISSUER_DOWNTIME"];

export type Opportunity = {
  leakId: string;
  checkoutId: string;
  leakClass: string;
  amountPaise: bigint;
  diagnosisClass: DiagnosisClass;
  verdict: "would_dispatch" | "would_hold_for_approval" | "no_action";
  reason: string | null;
  actionClass: ActionClass | null;
  evPaise: bigint | null;
};

/**
 * The Recovery Agent's dry run: for every leak Seam has detected but never
 * acted on, this runs the *real* decide() + evaluateShield() path — same
 * code, same math as `execute-action.ts` — and reports what would happen,
 * without actually sending anything. Stops short of calling
 * `executeAction()` itself because that needs a merchant's real, connected
 * Razorpay test-mode credentials to create a real payment link, and this
 * demo build has none configured (see LIMITATIONS.md) — the honest scope
 * cut is "tell the founder what Seam would do," not fabricate a dispatch
 * that never actually happened.
 */
export async function findOpportunities(
  merchantId: string,
  options: { now?: Date; evFloorPaise?: bigint; autoApproveThresholdPaise?: bigint; limit?: number } = {},
): Promise<Opportunity[]> {
  const now = options.now ?? new Date();
  const evFloorPaise = options.evFloorPaise ?? 5000n;
  const autoApproveThresholdPaise = options.autoApproveThresholdPaise ?? 150_000n;

  const [leaks, addressedLeakIds, downtimeWindows] = await Promise.all([
    prisma.leak.findMany({ where: { merchantId, class: { in: ACTIONABLE_CLASSES } } }),
    prisma.recoveryAction.findMany({ where: { merchantId }, select: { leakId: true } }),
    prisma.downtimeWindow.findMany(),
  ]);
  const addressed = new Set(addressedLeakIds.map((a) => a.leakId));
  const unaddressed = leaks.filter((leak) => !addressed.has(leak.id));

  const opportunities: Opportunity[] = [];
  for (const leak of unaddressed) {
    const attempt = await prisma.paymentAttempt.findFirst({
      where: { merchantId, checkoutId: leak.checkoutId! },
    });

    const diagnosisClass = classifyDiagnosis({
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
      opportunities.push({
        leakId: leak.id,
        checkoutId: leak.checkoutId!,
        leakClass: leak.class,
        amountPaise: leak.amountPaise,
        diagnosisClass,
        verdict: "no_action",
        reason: decision.reason,
        actionClass: null,
        evPaise: null,
      });
      continue;
    }

    // HOLD_AND_ESCALATE never reaches Shield or a customer at all — same
    // short-circuit execute-action.ts itself takes, for the identical
    // reason: it's a routing decision to a human, not a recovery spend.
    if (decision.action.actionClass === "HOLD_AND_ESCALATE") {
      opportunities.push({
        leakId: leak.id,
        checkoutId: leak.checkoutId!,
        leakClass: leak.class,
        amountPaise: leak.amountPaise,
        diagnosisClass,
        verdict: "would_hold_for_approval",
        reason: `diagnosis ${diagnosisClass} always routes to a human, never auto-contacted`,
        actionClass: decision.action.actionClass,
        evPaise: decision.action.evPaise,
      });
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

    opportunities.push({
      leakId: leak.id,
      checkoutId: leak.checkoutId!,
      leakClass: leak.class,
      amountPaise: leak.amountPaise,
      diagnosisClass,
      verdict:
        verdict.verdict === "PASS"
          ? "would_dispatch"
          : verdict.verdict === "NEEDS_APPROVAL"
            ? "would_hold_for_approval"
            : "no_action",
      reason: verdict.verdict === "PASS" ? null : verdict.reason,
      actionClass: decision.action.actionClass,
      evPaise: decision.action.evPaise,
    });
  }

  opportunities.sort((a, b) => {
    const evA = a.evPaise ?? 0n;
    const evB = b.evPaise ?? 0n;
    return evB > evA ? 1 : evB < evA ? -1 : 0;
  });

  return options.limit ? opportunities.slice(0, options.limit) : opportunities;
}
