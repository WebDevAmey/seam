/**
 * Net rupees recovered (predicted EV — see EVALUATION.md's disclosed gap on
 * "predicted vs realised") and messages sent, for three strategies over the
 * same generated leaks:
 *   do_nothing        — recovers 0, sends 0, costs 0.
 *   blast_everything   — same EV math as Seam's own policy, but with the EV
 *                        floor removed and Shield never consulted. The
 *                        naive strawman: contact every actionable leak.
 *   seam               — the real decide() + evaluateShield() path.
 * Only PAYMENT_BLOCKED and ISSUER_DOWNTIME leaks are actionable in this
 * build (see EVALUATION.md) — SILENT_ABANDON/PRE_CHECKOUT_DROP are detected
 * but Policy has no action mapping for them yet.
 * `pnpm exec tsx scripts/eval-baselines.ts dev|heldout`
 */
import { randomUUID } from "node:crypto";
import { classifyDiagnosis } from "../src/diagnosis/classify-diagnosis.js";
import type { ActionClass } from "../src/policy/decide.js";
import { decide } from "../src/policy/decide.js";
import { phrasingFor } from "../src/execute/compose-message.js";
import { generateMerchantDay } from "../src/generator/generate-merchant-day.js";
import { detectLeaksForMerchant } from "../src/leaks/detect-for-merchant.js";
import { prisma } from "../src/prisma.js";
import { evaluateShield } from "../src/shield/evaluate.js";

const SEEDS: Record<string, number> = { dev: 300, heldout: 900_303 };
const ACTIONABLE_CLASSES = ["PAYMENT_BLOCKED", "ISSUER_DOWNTIME"];
const EV_FLOOR_PAISE = 5000n;
const NOW = new Date("2026-09-04T12:00:00Z"); // fixed, clear of quiet hours

const DISPATCHABLE: readonly ActionClass[] = ["DELAYED_RETRY_LINK", "ALTERNATE_METHOD_LINK", "SAME_METHOD_LINK"];
function isDispatchable(actionClass: ActionClass): actionClass is (typeof DISPATCHABLE)[number] {
  return (DISPATCHABLE as readonly string[]).includes(actionClass);
}

async function main() {
  const setName = process.argv[2] ?? "dev";
  const seed = SEEDS[setName];
  if (!seed) throw new Error(`unknown set "${setName}" — use "dev" or "heldout"`);

  const merchant = await prisma.merchant.create({
    data: { name: `eval-baselines-${setName}`, email: `eval-baselines-${setName}-${seed}-${randomUUID()}@example.com` },
  });

  await generateMerchantDay({
    merchantId: merchant.id,
    seed,
    counts: { clean: 20, paymentBlocked: 12, issuerDowntime: 6, silentAbandon: 10, preCheckoutDrop: 8 },
  });
  await detectLeaksForMerchant(merchant.id);

  const leaks = await prisma.leak.findMany({
    where: { merchantId: merchant.id, class: { in: ACTIONABLE_CLASSES } },
  });
  const downtimeWindows = await prisma.downtimeWindow.findMany();

  let blastNetPaise = 0n;
  let blastMessages = 0;
  let seamNetPaise = 0n;
  let seamMessages = 0;
  let pendingApprovalNetPaise = 0n;
  let pendingApprovalCount = 0;
  const shieldTally = new Map<string, number>();

  for (const leak of leaks) {
    const attempt = await prisma.paymentAttempt.findFirst({
      where: { merchantId: merchant.id, checkoutId: leak.checkoutId! },
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

    // blast_everything: identical EV formula, floor removed — the naive
    // "contact everyone" strategy, not a strawman with worse math.
    const blastDecision = decide({
      leakAmountPaise: leak.amountPaise,
      diagnosisClass,
      channel: "sms",
      contactsInLast7Days: 0,
      evFloorPaise: -(10n ** 12n),
      now: NOW,
      downtimeResolvedAt,
    });
    if (blastDecision.kind === "action" && isDispatchable(blastDecision.action.actionClass)) {
      blastNetPaise += blastDecision.action.evPaise;
      blastMessages += 1;
    }

    // seam: the real floor, then the real Shield.
    const seamDecision = decide({
      leakAmountPaise: leak.amountPaise,
      diagnosisClass,
      channel: "sms",
      contactsInLast7Days: 0,
      evFloorPaise: EV_FLOOR_PAISE,
      now: NOW,
      downtimeResolvedAt,
    });
    if (seamDecision.kind === "action" && isDispatchable(seamDecision.action.actionClass)) {
      const verdict = evaluateShield({
        optedOut: false,
        now: NOW,
        contactsInLast7Days: 0,
        amountPaise: leak.amountPaise,
        merchantContactsToday: 0,
        merchantDailyOutreachCap: 1000,
        messageText: phrasingFor(seamDecision.action.actionClass),
        evPaise: seamDecision.action.evPaise,
        // Median EV in this run is ~₹813 (see NOTES.md) — a threshold has
        // to sit meaningfully above the typical action, not near the ₹200
        // floor, or "needs approval" swallows nearly everything and the
        // "auto" in auto-approve stops meaning anything.
        autoApproveThresholdPaise: 150_000n,
      });
      shieldTally.set(verdict.verdict, (shieldTally.get(verdict.verdict) ?? 0) + 1);
      if (verdict.verdict === "PASS") {
        seamNetPaise += seamDecision.action.evPaise;
        seamMessages += 1;
      } else if (verdict.verdict === "NEEDS_APPROVAL") {
        pendingApprovalNetPaise += seamDecision.action.evPaise;
        pendingApprovalCount += 1;
      }
    }
  }

  const toRupees = (paise: bigint) => (Number(paise) / 100).toFixed(2);
  const perRupee = (messages: number, netPaise: bigint) =>
    netPaise <= 0n ? "n/a" : (messages / (Number(netPaise) / 100)).toFixed(5);

  console.log(`\n=== Baselines eval — ${setName} (seed ${seed}) ===`);
  console.log(`${leaks.length} actionable leaks (PAYMENT_BLOCKED + ISSUER_DOWNTIME)\n`);
  console.log(`do_nothing:        net ₹0.00, 0 messages`);
  console.log(`blast_everything:  net ₹${toRupees(blastNetPaise)}, ${blastMessages} messages, ₹/msg-inverse=${perRupee(blastMessages, blastNetPaise)}`);
  console.log(`seam:              net ₹${toRupees(seamNetPaise)}, ${seamMessages} messages, ₹/msg-inverse=${perRupee(seamMessages, seamNetPaise)}`);
  console.log(`seam (pending):    ₹${toRupees(pendingApprovalNetPaise)} more across ${pendingApprovalCount} actions awaiting human approval — not counted above, since they weren't auto-dispatched`);
  console.log(`\nseam beats do_nothing: ${seamNetPaise > 0n}`);
  console.log(`seam beats blast_everything on net: ${seamNetPaise >= blastNetPaise}`);
  console.log(`seam sends fewer messages than blast_everything: ${seamMessages < blastMessages}`);
  console.log(`\nShield verdicts across all actionable leaks:`);
  for (const [verdict, count] of shieldTally) {
    console.log(`  ${verdict}: ${count}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
