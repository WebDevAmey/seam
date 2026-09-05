/**
 * Seeds one demo merchant with a full, realistic dataset and then runs the
 * *real* agent pipeline over it (detect, diagnose, decide + Shield, an
 * intelligence sweep, a couple of simulated inbound replies) so every row
 * in every feature page — leak map, agent fleet, recovery queue, ledger,
 * conversations, digest — is something the actual code produced, not a
 * hand-typed fixture standing in for it.
 *
 * Safe to re-run: deletes any prior demo merchant (by email) and every row
 * scoped to it first, so the dataset stays internally consistent instead of
 * accumulating duplicates across runs.
 */
import { randomUUID } from "node:crypto";
import { hashPassword } from "../src/auth/password.js";
import { generateMerchantDay } from "../src/generator/generate-merchant-day.js";
import { generatePaymentHistory } from "../src/generator/generate-payment-history.js";
import { detectLeaksForMerchant } from "../src/leaks/detect-for-merchant.js";
import { recordAgentRun } from "../src/agents/harness.js";
import { runDiagnosisAgent } from "../src/agents/diagnosis-agent.js";
import { runRecoveryExecutor } from "../src/agents/recovery-executor.js";
import { runShieldRecheck } from "../src/agents/shield-recheck.js";
import { analyzeLeakIntelligence } from "../src/intelligence/analyze-merchant.js";
import { handleReply } from "../src/replies/handle-reply.js";
import { prisma } from "../src/prisma.js";

const DEMO_EMAIL = "founder@kolamandco.example";
const DEMO_PASSWORD = "seamdemo123";

async function resetExistingDemoMerchant() {
  const existing = await prisma.merchant.findUnique({ where: { email: DEMO_EMAIL } });
  if (!existing) return;
  const merchantId = existing.id;

  const leakIds = (await prisma.leak.findMany({ where: { merchantId }, select: { id: true } })).map((l) => l.id);
  const threadIds = (await prisma.chatThread.findMany({ where: { merchantId }, select: { id: true } })).map((t) => t.id);

  await prisma.diagnosis.deleteMany({ where: { leakId: { in: leakIds } } });
  await prisma.chatMessage.deleteMany({ where: { threadId: { in: threadIds } } });
  await prisma.ticket.deleteMany({ where: { merchantId } });
  await prisma.recoveryAction.deleteMany({ where: { merchantId } });
  await prisma.agentRun.deleteMany({ where: { merchantId } });
  await prisma.chatThread.deleteMany({ where: { merchantId } });
  await prisma.optOut.deleteMany({ where: { merchantId } });
  await prisma.ledgerEntry.deleteMany({ where: { merchantId } });
  await prisma.leak.deleteMany({ where: { merchantId } });
  await prisma.paymentAttempt.deleteMany({ where: { merchantId } });
  await prisma.funnelEvent.deleteMany({ where: { merchantId } });
  await prisma.rawEvent.deleteMany({ where: { merchantId } });
  await prisma.razorpayConnection.deleteMany({ where: { merchantId } });
  await prisma.shopifyConnection.deleteMany({ where: { merchantId } });
  // Not merchant-scoped in this schema (see generate-merchant-day.ts's own
  // comment: implicitly global, issuer-wide data) — left uncleaned, repeated
  // reseeds would accumulate a duplicate "upi" window per run, and which one
  // `.find()` picks first is an unspecified DB row order, not a real bug but
  // a needless source of run-to-run drift in this always-single-demo-merchant
  // dev database.
  await prisma.downtimeWindow.deleteMany({});
  await prisma.merchant.delete({ where: { id: merchantId } });
  console.log(`Cleared previous demo merchant (${merchantId}) before reseeding.`);
}

// The generator draws a random reason per payment-blocked checkout from a
// pool that includes exactly one classifyDiagnosis can't resolve
// ("payment_failed"), so whether the Diagnosis Agent's LLM escalation
// actually fires in a given seed run is otherwise down to RNG luck. This
// guarantees one, so the live Groq path is reliably demoable regardless.
async function seedGuaranteedLlmEscalationLeak(merchantId: string) {
  const checkoutId = "checkout_llm_escalation_demo";
  const amountPaise = 150_000n; // clears every floor comfortably
  const attempt = await prisma.paymentAttempt.create({
    data: {
      merchantId,
      rzpPaymentId: `pay_synthetic_${randomUUID()}`,
      rzpOrderId: `order_synthetic_${randomUUID()}`,
      checkoutId,
      joinConfidence: 1,
      joinMethod: "notes",
      method: "card",
      status: "failed",
      amountPaise,
      attemptedAt: new Date(),
      errorReason: "payment_failed",
      errorDescription: "Generic decline with no further detail from the issuer.",
    },
  });
  await prisma.leak.create({
    data: { merchantId, class: "PAYMENT_BLOCKED", amountPaise, checkoutId, evidenceEventIds: [attempt.id], confidence: 1 },
  });
}

// A guaranteed example of Shield actually blocking something, visibly: the
// recovery queue page's own stated principle is that blocked actions stay
// visible with their reason rather than being hidden, which needs at least
// one real blocked action to demonstrate. Below the ₹200 recovery floor by
// construction, regardless of what the generator's random amounts land on.
async function seedGuaranteedBlockedLeak(merchantId: string) {
  // ISSUER_DOWNTIME's 0.35 recovery prior is what makes this possible at
  // all: the amount has to be large enough to clear decide()'s own EV
  // floor (so it actually reaches Shield) while staying under Shield's
  // separate ₹200 raw-amount floor — a window that only exists for a
  // diagnosis class with a recovery rate this high. Below it, decide()
  // itself would reject the leak as "no action" before Shield ever runs.
  const checkoutId = "checkout_shield_block_demo";
  const amountPaise = 18_000n; // ₹180 — clears the EV floor, misses Shield's ₹200 floor
  const attempt = await prisma.paymentAttempt.create({
    data: {
      merchantId,
      rzpPaymentId: `pay_synthetic_${randomUUID()}`,
      rzpOrderId: `order_synthetic_${randomUUID()}`,
      checkoutId,
      joinConfidence: 1,
      joinMethod: "notes",
      method: "upi",
      status: "failed",
      amountPaise,
      attemptedAt: new Date(),
      errorReason: "issuer timeout",
    },
  });
  await prisma.leak.create({
    data: { merchantId, class: "ISSUER_DOWNTIME", amountPaise, checkoutId, evidenceEventIds: [attempt.id], confidence: 1 },
  });
}

// Shield's quiet-hours check (21:00-09:00 IST) is real and correctly
// fail-closed — a live "Run all agents" click should use the actual
// current time, quiet hours included. This seed script's job is different:
// producing a demoable dataset regardless of what real time it happens to
// run at, so it pins the executor/Shield-recheck clock to a fixed daytime
// IST hour on today's real date, rather than leaving the demo's mix of
// reserved-vs-blocked actions to depend on when someone happens to seed it.
function daytimeIST(): Date {
  const isoDate = new Date().toISOString().slice(0, 10);
  return new Date(`${isoDate}T06:30:00.000Z`); // 12:00 IST
}

async function main() {
  await resetExistingDemoMerchant();

  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const merchant = await prisma.merchant.create({
    data: { name: "Kolam & Co.", email: DEMO_EMAIL, passwordHash },
  });

  // A single, richer merchant-day: enough volume across all four
  // detector-covered leak classes that every downstream agent has
  // something real to work with. 10 payment-blocked checkouts (vs. the
  // 6-reason pool in generate-merchant-day.ts) reliably includes at least
  // one "payment_failed" decline — the one reason deliberately left
  // outside classifyDiagnosis's rules, so the Diagnosis Agent actually
  // escalates to the live LLM (Groq) instead of only ever resolving by
  // pattern-matching alone.
  await generateMerchantDay({
    merchantId: merchant.id,
    seed: 42,
    counts: { clean: 25, paymentBlocked: 10, issuerDowntime: 4, silentAbandon: 10, preCheckoutDrop: 8 },
  });

  // Wrapped in the real harness, same as the fleet's "Run now" / "Run all
  // agents" buttons, so a fresh demo login shows real run history
  // immediately instead of data with no audit trail behind it.
  const leaksCreated = await recordAgentRun("detector", merchant.id, {}, async () => {
    const { created } = await detectLeaksForMerchant(merchant.id);
    return { output: { created }, summary: created > 0 ? `found ${created} new leaks` : "no new leaks found" };
  });
  await seedGuaranteedLlmEscalationLeak(merchant.id);
  await seedGuaranteedBlockedLeak(merchant.id);

  // Anchored to the real "now," not a fixed date: Leak Intelligence's
  // "Run analysis" button always checks today's actual date (correct
  // production behavior), so a fixed historical seed date would only ever
  // match on the one day it was written. A 10-day baseline plus a genuine
  // spike on the last day means the button finds something real the
  // moment you click it, on whatever day you actually seed this.
  await generatePaymentHistory({
    merchantId: merchant.id,
    days: 10,
    baselineDeclineRate: 0.08,
    attemptsPerDay: 20,
    seed: 7,
    spike: { method: "upi", declineRate: 0.65 },
    anchorDate: new Date(),
  });

  // From here on, this is the real pipeline running live — the same
  // functions the agent fleet's "Run now" / "Run all agents" buttons call,
  // not a parallel hand-seeded shortcut.
  const now = daytimeIST();
  const diagnosisResult = await recordAgentRun("diagnosis", merchant.id, {}, async () => {
    const r = await runDiagnosisAgent(merchant.id);
    return {
      output: r,
      summary: r.processed > 0 ? `diagnosed ${r.processed} leak${r.processed === 1 ? "" : "s"} (${r.bySource.rules} by rules, ${r.bySource.llm} by LLM)` : "no undiagnosed leaks found",
    };
  });
  const executorResult = await recordAgentRun("recovery", merchant.id, {}, async () => {
    const r = await runRecoveryExecutor(merchant.id, { now });
    return { output: r, summary: `reserved ${r.reserved}, blocked ${r.blocked}, no action on ${r.noAction}` };
  });
  const shieldResult = await recordAgentRun("shield", merchant.id, {}, async () => {
    const r = await runShieldRecheck(merchant.id, now);
    return {
      output: r,
      summary: r.checked > 0 ? `${r.stillPass} of ${r.checked} pending actions still pass, ${r.nowBlocked} would now be blocked` : "no pending actions to recheck",
    };
  });
  const today = new Date().toISOString().slice(0, 10);
  const intelligenceResult = await recordAgentRun("intelligence", merchant.id, { date: today }, async () => {
    const r = await analyzeLeakIntelligence(merchant.id, today);
    return {
      output: r,
      summary: r.findings.length > 0 ? `${r.findings.length} method-concentration finding${r.findings.length === 1 ? "" : "s"}, ${r.leaksCreated} new` : "no concentration findings",
    };
  });

  // A handful of simulated inbound replies against real, just-reserved
  // actions — the Conversation Agent's own work, not fabricated tickets.
  // Real reply-webhook receiving is still simulated at the transport layer
  // only (LIMITATIONS.md §5); everything from here down (classification,
  // ticketing, the opt-out write) is the real code path.
  const reservedActions = await prisma.recoveryAction.findMany({
    where: { merchantId: merchant.id, state: { in: ["RESERVED", "FAILED"] } },
    take: 5,
  });
  const sampleReplies = [
    { text: "STOP messaging me, I already reported this number", phone: "+919812300001" },
    { text: "Not interested, please cancel my order", phone: "+919812300002" },
    { text: "wait what is this about?", phone: "+919812300003" },
    { text: "already paid this yesterday", phone: "+919812300004" },
    { text: "will pay in a bit, on it", phone: "+919812300005" },
  ];
  let repliesHandled = 0;
  for (let i = 0; i < reservedActions.length && i < sampleReplies.length; i++) {
    const action = reservedActions[i]!;
    const reply = sampleReplies[i]!;
    await handleReply({ merchantId: merchant.id, recoveryActionId: action.id, customerPhone: reply.phone, text: reply.text });
    repliesHandled++;
  }

  console.log(`Seeded demo merchant: ${merchant.id}`);
  console.log(`Log in at http://localhost:3000/login with:`);
  console.log(`  email:    ${DEMO_EMAIL}`);
  console.log(`  password: ${DEMO_PASSWORD}`);
  console.log("");
  console.log("Real pipeline results:");
  console.log(`  leaks detected:        ${leaksCreated.created}`);
  console.log(`  diagnoses:             ${diagnosisResult.processed} (${diagnosisResult.bySource.rules} rules, ${diagnosisResult.bySource.llm} llm)`);
  console.log(`  recovery actions:      ${executorResult.reserved} reserved, ${executorResult.blocked} blocked, ${executorResult.noAction} no-action`);
  console.log(`  shield recheck:        ${shieldResult.stillPass} of ${shieldResult.checked} pending still pass`);
  console.log(`  intelligence findings: ${intelligenceResult.findings.length} (${intelligenceResult.leaksCreated} new leaks)`);
  console.log(`  conversations handled: ${repliesHandled}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
