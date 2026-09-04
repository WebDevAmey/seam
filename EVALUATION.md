# Evaluation

Pre-registered before any of the numbers below this line existed. Written first, results appended after — not the other way around. (This repo isn't under git commits yet in this session, so the usual proof-by-commit-timestamp doesn't apply here; the proof instead is that this file's metric definitions are written and the actual eval script code doesn't exist yet at the point this paragraph is written. Once commits start, this file's history is the record.)

## What's being measured, and why

Four things this system claims to do, each with a metric that would catch it lying:

1. **Leak detection is accurate.** Precision/recall per class, against the synthetic generator's own ground truth (`src/generator/generate-merchant-day.ts`) — it knows exactly which checkouts are leaks and which class, because it planted them.
2. **The join engine actually joins.** Precision/recall for the scored fallback path specifically (`resolveJoin`'s non-notes branch) — the interesting number, since the notes path is deterministic by construction and proves nothing about the fuzzy matcher.
3. **Recovery is worth doing, on net, compared to not bothering and compared to bothering with everyone.** Two baselines: `do_nothing` (send nothing, recover nothing, spend nothing) and `blast_everything` (send to every detected leak regardless of EV). Seam's actual policy has to beat both — trivially beats `do_nothing`, and has to beat `blast_everything` **on net rupees, with fewer messages**, which is the actual product claim, not a strawman.
4. **Shield does what it says.** Block rate and the reason breakdown, over the same generated data.

## Metrics table

| Metric | Target | Where it's computed |
|---|---|---|
| Leak detection precision/recall, per class | report all 4 detectable classes (`PAYMENT_BLOCKED`, `ISSUER_DOWNTIME`, `SILENT_ABANDON`, `PRE_CHECKOUT_DROP`) | `apps/api/scripts/eval-detection.ts` |
| Join precision/recall, scored-fallback path only | report both | `apps/api/scripts/eval-join.ts` |
| Net rupees recovered (predicted EV) vs `do_nothing` | must beat | `apps/api/scripts/eval-baselines.ts` |
| Net rupees recovered (predicted EV) vs `blast_everything` | must beat on net, with fewer messages | `apps/api/scripts/eval-baselines.ts` |
| Messages sent per rupee recovered | lower is the product claim | `apps/api/scripts/eval-baselines.ts` |
| Shield block rate and reasons | report | `apps/api/scripts/eval-baselines.ts` |

**Disclosed up front, not discovered later:** "net rupees recovered" here is **predicted EV**, not realised recovery — there's no outcome worker in this build tracking whether a `payment.captured` webhook actually arrived within 72h of a dispatched action (PRD's outcome-attribution loop is on the cut list, and it was cut). So "beats `do_nothing`/`blast_everything`" is a claim about the policy's expected-value arithmetic being sound, not a claim about rupees that were actually observed to move. `p_recover`'s hand-set priors (`src/policy/decide.ts`) are exactly that — hand-set, not learned or validated against real outcomes — and that's disclosed here rather than implied away.

**Also disclosed:** `METHOD_CONCENTRATION` and `POST_PURCHASE_LEAK` have no detector and no eval numbers, for the reasons already logged in `LEARNINGS.md` (no 14-day baseline data, no refund model). Diagnosis-accuracy-vs-ground-truth-cause isn't reported either — the deterministic ~75% path (`classifyDiagnosis`) has no independent ground-truth label to score against in the generator's data (the generator doesn't currently attach a specific decline *reason* to `PAYMENT_BLOCKED` checkouts, just the class), and the LLM path (Block 7) has no live model to call. Both are real gaps, not hidden ones.

## Two seeded sets

- **Dev set:** seed `100`.
- **Held-out set:** seed `900101`. Opened exactly once. The date/time it was first run is recorded in `NOTES.md` at that moment, not reconstructed after.

If held-out performs worse than dev, that's reported as-is, quantified, not smoothed over.

## Failure injection suite

Six scenarios, all already individually proven by tests written during the corresponding block of work — this section is the consolidated map from the PRD's own language to where each one actually lives, not a re-implementation:

| Scenario | Proven in |
|---|---|
| 10 identical webhooks in the same millisecond → exactly one action, nine read cached state | `src/ingest/claim.test.ts`, `src/execute/reserve-action.test.ts` |
| Razorpay API timeout mid-dispatch → no duplicate link created | `src/execute/execute-action.test.ts` ("a real dispatch failure releases the lock instead of wedging it") |
| Malformed LLM JSON → validator rejects → safe default | `src/diagnosis/graph.test.ts` ("treats a thrown error from classify... the same as an invalid result") |
| Prompt injection in a product title → flagged, routed to human | `src/diagnosis/injection-fixtures.test.ts` |
| Crash mid-diagnosis → checkpoint resumes, no orphaned reservation | `src/diagnosis/graph.test.ts` ("resumes after a crash between rounds") |
| Quiet-hours boundary at 20:59:59 / 09:00:00 IST → correct verdict both sides | `src/shield/evaluate.test.ts` |

`apps/api/scripts/failure-injection-report.ts` runs all of the above and prints a pass/fail summary in one place for the video/README, without duplicating their logic.

---

## Results — dev set (seed 100 / 200 / 300)

**Leak detection:** perfect on all four detectable classes — precision 1.000, recall 1.000, 43/43 planted leaks found exactly. Expected: this is the same property `detect-for-merchant.test.ts` already proves per-run; this script is the same claim run at eval scale rather than a different result.

**Join (scored fallback only):** precision 1.000 (never once joins the wrong checkout), recall 0.333. The recall number needs its breakdown to be honest, not just the headline: of 30 real matches, a third had clean signal and were correctly accepted, a third had exactly one strong signal missing (email *or* phone) and landed in the 0.50–0.75 ambiguous band — correctly held back, not wrongly joined — and a third had two signals missing plus a stale timestamp and correctly returned no join at all. Recall against genuinely under-specified data isn't supposed to be high; that's the ambiguous band doing its job. The number that actually matters here is the zero false positives.

**Baselines:** `seam` beat `do_nothing` (₹11,852.50 vs ₹0). Against `blast_everything`, this run **tied exactly** — same net (₹11,852.50), same message count (16), because none of the 18 actionable leaks in this particular random draw happened to fall below the ₹50 EV floor. That's a disclosed, real result, not smoothed over: the floor and Shield's contact cap both exist to reject *some* leaks, and in a single-day, independent-leak synthetic dataset with no repeat customers, neither ever got the chance to reject anything. The honest read is that this eval, as built, doesn't yet exercise the scenario where Seam's floor/cap actually pays for itself — that would need multi-day data with repeat customers hitting the 2-contacts-per-7-days cap, and low-value carts landing under the floor, which a single independent-leaks-per-run dataset doesn't produce by construction. Flagged here as a real gap in the eval's scenario coverage, not in the policy itself — `evaluate.test.ts` and `decide.test.ts` already prove the floor and the cap work in isolation; this eval doesn't yet prove they *matter* at the portfolio level on this particular dataset.

Shield verdicts: 16 PASS, 0 blocked, 0 needing approval, on this run.

## Results — held-out set (opened once, 2026-09-04T14:23:52Z — see `NOTES.md`)

**Leak detection:** identical to dev — precision 1.000, recall 1.000, all four classes. Expected, not a coincidence to be suspicious of: the detector's correctness doesn't depend on which random amounts or timestamps the generator happened to draw for a given seed, only on the structural relationships (a checkout_start with a failed payment and no success, etc.) that the generator always constructs the same way regardless of seed.

**Join (scored fallback):** also identical to dev — precision 1.000, recall 0.333. This one **is** a real limitation of the eval script worth disclosing plainly: `eval-join.ts` always builds exactly 10 clean / 10 ambiguous-by-construction / 10 unmatchable-by-construction / 10 noise scenarios regardless of seed — only the specific random amounts, emails, and timestamps *within* each tier vary. So this script structurally cannot show seed-to-seed variance in the aggregate precision/recall numbers; it would need randomised degradation *rates*, not just randomised values within fixed tiers, to be a meaningful held-out test of the join scorer specifically. Flagged here rather than presented as a held-out result that "held up" — it never had the chance to move.

**Baselines:** this time seam did **not** tie blast_everything — dispatched net ₹8,101.95 (13 messages) vs blast's ₹9,675.85 (15 messages). But the gap has a complete, traceable explanation rather than being an unexplained shortfall: one action (₹1,541.90 of the ₹1,574 gap) was correctly held for human approval rather than auto-blasted — Seam's *total addressable value* (dispatched + pending) is ₹9,643.85, within ₹32 of blast's total. The remaining ~₹32 is one leak that correctly fell below the ₹50 EV floor and wasn't sent at all. So the honest framing: on this run, Seam finds essentially the same total value as blindly messaging everyone, while auto-sending 2 fewer messages, correctly routing the single largest action to a human instead of firing it automatically, and correctly declining to spend messaging budget on the one leak not worth the cost of contacting. That is a materially different — and more defensible — claim than a raw "net rupees recovered" comparison shows on its own, and it only became visible by disclosing the pending-approval number instead of just excluding it.

**What this means for the "must beat blast_everything on net" bar (PRD §10):** across the two seeded sets, Seam ties or trails blast_everything on immediately-auto-dispatched net value, and both times the full explanation is Shield correctly gating specific actions (one to human review, one below the profitability floor) that a naive strategy would have fired blindly. Reported as a real, disclosed gap rather than smoothed into a claimed win it didn't cleanly earn — see `LIMITATIONS.md`.

