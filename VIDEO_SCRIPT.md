# Video script — 5 minutes, per PRD §15

A shot list, not a word-for-word script: say these things in your own voice, in this order, on these screens. Every number below is real — pulled from `EVALUATION.md`, `NOTES.md`, and a live run against the seeded demo merchant (`founder@kolamandco.example`) — not written for the video and then matched to the build afterward.

**Before recording:** run `pnpm dev` in both `apps/api` and `apps/web`, sign in as the demo merchant, and have these tabs ready: `/recovery/digest`, `/recovery/map`, `/recovery/queue`, `/recovery/ledger`, a terminal in `apps/api`, and this repo's `README.md` architecture diagram (or `ARCHITECTURE.md`) full-screen or in an editor.

---

## 0:00–0:30 — The downtime sentence, with a real rupee figure on screen

**Screen:** `/recovery/digest`, scrolled to the narrative paragraph.

**Say:**
> "A founder asks the only question that actually matters: revenue dropped — why? Here's Seam's own answer for one real demo merchant, one real week: ₹49,997 across 18 leaks, mostly silent abandons and payment blocks. Every rupee traced to a specific cause — not a guess."

Point at the actual sentence on screen (`Between 2026-08-28 and 2026-09-04, Seam found ₹49,997.00 across 18 leaks...`) as you say it. This is a real digest computed from real seeded data, not a mockup.

---

## 0:30–1:30 — One leak end to end, including one Shield blocked, and why

**Screen:** `/recovery/map` → click into one leak → `/recovery/queue`.

**Say:**
> "Follow one leak. [Pick a `PAYMENT_BLOCKED` or `SILENT_ABANDON` leak on the map.] It joined a Shopify checkout to a Razorpay payment attempt, got classified deterministically — no model in this step — and Policy computed an expected value: probability of recovery times the amount, minus channel cost and annoyance cost."

Switch to `/recovery/queue`. Find one row where `shieldVerdict` is `BLOCK` or `NEEDS_APPROVAL` — the demo data has real ones (e.g., an action blocked for "amount below the ₹200 recovery floor", or one held for approval because EV is above the auto-approve threshold).

> "And here's one Shield blocked. [Point at the reason string, verbatim, on screen.] That's the point: anyone can demo the happy path. The claim is what happens when the system decides *not* to act — and that decision is deterministic, not a model's judgment call."

---

## 1:30–3:00 — Architecture, and the trust boundary defended

**Screen:** the pipeline diagram (`README.md` or `ARCHITECTURE.md`).

**Say, walking the diagram top to bottom:**
> "Ingest just verifies an HMAC and writes a row — nothing else, so webhook ack latency never depends on anything downstream. Resolve joins Shopify and Razorpay at the one place they can actually be joined: the checkout — a deterministic notes-field join first, a scored fallback (email, phone, amount, timestamp) when that's missing, with a real ambiguous zone that holds back rather than guesses.
>
> Detect is one pure function — no model. Diagnose is where a language model gets involved, and only for the payment-failure classes, and only after roughly three-quarters of cases are already resolved by pattern-matching Razorpay's own error fields. Where the model runs, its output is constrained to a Zod schema — it classifies a cause, nothing more. It never authors an amount, a link, or a deadline. Those come from fixed templates and the real payment link, injected after the model's turn is over. That's the trust boundary: the model proposes a classification; deterministic code disposes.
>
> Policy is a pure function computing EV — same inputs, same output, always. Shield is seven ordered, fail-closed checks — proven fail-closed with a genuine thrown exception, not an inspected try/catch. Execute is idempotent — a status-scoped partial unique index in Postgres, not application-level discipline, guarantees no double-dispatch even under real concurrency. And every terminal outcome, including every block, gets appended to a hash-chained ledger."

*(Optional, if time allows: mention the LangGraph checkpointer proving crash-resumability via `interruptAfter`, not a simulated abort — a resuming process genuinely can't tell "paused" from "died," so this is the real guarantee, not a stand-in for it.)*

---

## 3:00–4:15 — Eval results against both baselines, and what it got wrong

**Screen:** `EVALUATION.md`, or a terminal running the eval scripts.

**Say:**
> "Pre-registered before any results existed — the metrics are committed to this repo before the harness that produces them. Detection: precision and recall both 1.000, on all four classes we can currently detect, on both the dev set and a held-out set opened exactly once. Join: precision 1.000 — it never once joins the wrong checkout. Recall is 0.333, and that number needs its context: a third of held-out cases were correctly held in the ambiguous zone rather than wrongly joined. Zero false positives is the number that actually matters for a join engine attached to money.
>
> Now the part most demos skip: on the held-out run, Seam did *not* beat blast-everything on raw net value — ₹8,101.95 dispatched against blast's ₹9,675.85. But the whole gap is explained, not hand-waved: one ₹1,541.90 action was correctly held for a human to approve instead of auto-firing — Seam's total addressable value is ₹9,643.85, within ₹32 of blast's total — and the remaining ₹32 is one leak that correctly fell below the profitability floor and wasn't worth contacting a customer over. Same total value found, two fewer messages sent, and the one large decision correctly routed to a person instead of a script. That's a more defensible claim than a bigger net-value number would have been, and it's reported exactly as it came out."

---

## 4:15–4:45 — Ledger verify, live, on camera

**Screen:** `/recovery/ledger` → click "Verify chain".

**Say:**
> "Every action this system has ever taken — dispatched, blocked, escalated — is one hash-chained, append-only ledger. Watch: this recomputes the entire chain from genesis, live, right now." [Click the button; wait for "Valid — every entry checks out from genesis."] "Not a log line I could have edited after the fact. A chain that's mathematically either intact or it isn't."

---

## 4:45–5:00 — Why Open Track, in one sentence

**Say:**
> "Track 03 scores money recovered from payment failures — Seam recovers those too, but a payment-recovery agent that wins ₹40,000 back while the merchant loses ₹3 lakh to a shipping-cost surprise on the checkout page has solved the visible problem and missed the expensive one — and that's a claim Track 03's own scope can't hold, which is why this is Open Track."

---

## Notes for whoever records this

- **Say what it's not**, once, plainly, somewhere in the middle: outbound and inbound WhatsApp/SMS are simulated behind a swappable interface; the LLM diagnosis path has never run against a live model (no API key configured); "recovered" throughout is predicted EV, not confirmed realised revenue — there's no outcome worker yet. Naming these unprompted lands better than a judge finding them first.
- If asked live "what would you do with one more day," the honest answer is in `LIMITATIONS.md` — the `POST_PURCHASE_LEAK` class, the outcome worker for realised (not predicted) recovery, and Render deployment are the three real next items.
- Don't claim inherited history the repo doesn't have. The application — the pipeline, the agent fleet, auth, the dashboard — is standalone, written from scratch for this buildathon. If asked about the landing page specifically: its structure and motion are adapted from Ovrt, the same team's other project, with the copy and screenshots rewritten for Seam and the accent recolored to blue — say that plainly rather than letting it come across as the whole application's origin. See `DECISIONS.md` for the full account.
