/**
 * Join precision/recall for the *scored fallback* path only (PRD §4.2,
 * §10) — the notes path is deterministic by construction, so evaluating it
 * would prove nothing about the actual matcher. Pure-function eval, no DB:
 * `resolveJoin` takes plain objects, so this generates synthetic
 * payment/candidate pools with controlled degradation and measures
 * `resolveJoin` directly. `pnpm exec tsx scripts/eval-join.ts dev|heldout`.
 */
import { createRng, randomInt } from "../src/generator/rng.js";
import { type CheckoutCandidate, type PaymentForJoin, resolveJoin } from "../src/join/resolve.js";

const SEEDS: Record<string, number> = { dev: 200, heldout: 900_202 };

const T0 = new Date("2026-09-04T10:00:00Z");

type Scenario = {
  trueCheckoutId: string | null; // null = genuinely no match should exist
  payment: PaymentForJoin;
  candidates: CheckoutCandidate[];
};

function buildScenario(rng: () => number, index: number): Scenario {
  const trueCheckoutId = `checkout_${index}`;
  const email = `buyer${index}@example.com`;
  const phone = `+9198765${String(index).padStart(5, "0")}`;
  const amountPaise = BigInt(randomInt(rng, 300, 5000) * 100);
  const trueOccurredAt = new Date(T0.getTime() + index * 3_600_000);

  // Distractor candidates — same time window, different identity, so the
  // scorer actually has to discriminate, not just return "the only option."
  const distractors: CheckoutCandidate[] = Array.from({ length: 3 }, (_, d) => ({
    checkoutId: `distractor_${index}_${d}`,
    customerEmail: `someone${index}-${d}@example.com`,
    customerPhone: `+9199999${String(index * 10 + d).padStart(5, "0")}`,
    amountPaise: BigInt(randomInt(rng, 300, 5000) * 100),
    occurredAt: new Date(trueOccurredAt.getTime() + randomInt(rng, -300_000, 300_000)),
  }));

  const trueCandidate: CheckoutCandidate = {
    checkoutId: trueCheckoutId,
    customerEmail: email,
    customerPhone: phone,
    amountPaise,
    occurredAt: trueOccurredAt,
  };

  // Degrade the payment's own identifying info — the realistic messiness a
  // real merchant's data actually has. Roughly a third clean, a third
  // partially degraded, a third heavily degraded.
  const degradation = index % 3;
  const payment: PaymentForJoin = {
    notesCheckoutId: null,
    email: degradation === 2 ? null : email,
    phone: degradation >= 1 ? null : phone,
    amountPaise,
    attemptedAt: new Date(trueOccurredAt.getTime() + (degradation === 2 ? 400_000 : 30_000)),
  };

  return { trueCheckoutId, payment, candidates: [trueCandidate, ...distractors] };
}

function buildNoMatchScenario(rng: () => number, index: number): Scenario {
  // A payment with no real checkout behind it at all — every candidate is
  // a distractor. resolveJoin should return "none".
  const candidates: CheckoutCandidate[] = Array.from({ length: 3 }, (_, d) => ({
    checkoutId: `noise_${index}_${d}`,
    customerEmail: `noise${index}-${d}@example.com`,
    customerPhone: `+9188888${String(index * 10 + d).padStart(5, "0")}`,
    amountPaise: BigInt(randomInt(rng, 300, 5000) * 100),
    occurredAt: new Date(T0.getTime() + randomInt(rng, 0, 20) * 3_600_000),
  }));
  return {
    trueCheckoutId: null,
    payment: {
      notesCheckoutId: null,
      email: `unmatched${index}@example.com`,
      phone: `+9177777${String(index).padStart(5, "0")}`,
      amountPaise: BigInt(randomInt(rng, 300, 5000) * 100),
      attemptedAt: new Date(T0.getTime() + randomInt(rng, 0, 20) * 3_600_000),
    },
    candidates,
  };
}

function main() {
  const setName = process.argv[2] ?? "dev";
  const seed = SEEDS[setName];
  if (!seed) throw new Error(`unknown set "${setName}" — use "dev" or "heldout"`);
  const rng = createRng(seed);

  const scenarios: Scenario[] = [
    ...Array.from({ length: 30 }, (_, i) => buildScenario(rng, i)),
    ...Array.from({ length: 10 }, (_, i) => buildNoMatchScenario(rng, i)),
  ];

  let truePositives = 0; // accepted join, correct checkout
  let falsePositives = 0; // accepted join, wrong checkout (or accepted when none should exist)
  let falseNegatives = 0; // a true match existed but wasn't accepted (none or ambiguous)
  let ambiguousCount = 0;
  let correctNoMatch = 0;

  for (const scenario of scenarios) {
    const result = resolveJoin(scenario.payment, scenario.candidates);
    const accepted = result.method === "fuzzy" && !result.ambiguous;

    if (scenario.trueCheckoutId === null) {
      if (accepted) falsePositives++;
      else correctNoMatch++;
      continue;
    }

    if (accepted && result.checkoutId === scenario.trueCheckoutId) {
      truePositives++;
    } else if (accepted) {
      falsePositives++; // accepted, but the wrong checkout
    } else {
      falseNegatives++;
      if (result.method === "fuzzy" && result.ambiguous) ambiguousCount++;
    }
  }

  const precision = truePositives + falsePositives === 0 ? null : truePositives / (truePositives + falsePositives);
  const recall = truePositives + falseNegatives === 0 ? null : truePositives / (truePositives + falseNegatives);

  console.log(`\n=== Join eval (scored fallback only) — ${setName} (seed ${seed}) ===`);
  console.log(`${scenarios.length} scenarios (${scenarios.length - 10} real matches, 10 genuine non-matches)`);
  console.log(`tp=${truePositives} fp=${falsePositives} fn=${falseNegatives} (${ambiguousCount} of those were correctly flagged ambiguous, not actioned) correct-no-match=${correctNoMatch}`);
  console.log(`precision=${precision === null ? "n/a" : precision.toFixed(3)}  recall=${recall === null ? "n/a" : recall.toFixed(3)}`);
}

main();
