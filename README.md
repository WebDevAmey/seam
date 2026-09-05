# Seam

**The revenue leak detective for Shopify + Razorpay.**

Seam joins your Shopify checkout funnel to your Razorpay payment rail, attributes every lost rupee to a cause, and executes bounded, EV-gated recovery on the leaks worth fixing — behind a deterministic gate a language model can never talk its way around.

Built for Razorpay's AI Buildathon, Track 05 (Open).

Live demo → · Architecture deep-dive · How it was built (blog) · Quick setup

> The backend is on Render's free tier, which spins down after ~15 minutes idle — the first request after a gap can take ~50s to wake up. If the dashboard looks empty at first, give it a moment and refresh.

---

## What it actually does

**One sentence a judge should walk away with:** the LLM never touches money directly. It only ever gets to propose. A separate, 100% deterministic layer — 7 plain safety checks, zero AI — decides whether that proposal is allowed to run, and a third layer is the only thing allowed to actually run it. Every decision, blocked or executed, is written to a tamper-evident audit trail.

---

## See it working

| Feature | What you're looking at |
|---|---|
| **Live agent feed** | Every decision streams in as it happens, badged by source (🤖 AI-proposed / ⚙️ shield-blocked / 📐 heuristic-fallback) |
| **Full reasoning trace** | Root cause, confidence, every shield check pass/fail, action, outcome |
| **Counterfactual sandbox** | Pick a different action and watch the real shield engine judge it live |
| **vs. Baseline** | The same batch run through 4 policies with common random numbers, headline number is incremental recovery, plus a live hash-chain integrity badge |
| **Seed stability check** | The same comparison re-run across 20 seeds; rupee totals flagged noisy, rates and counts confirmed stable |
| **LLM vs. heuristic agreement** | A real run: how often the LLM's judgment matches the zero-AI fallback's — shown honestly, not cherry-picked |

Full walkthrough with narration: [`BLOG.md`](./BLOG.md).

---

## Why this exists — the track's actual bar

Track 05 is explicit: *"don't just identify the problem — show measured money recovered across a batch, with compliant escalation, stopping rules, and an audit trail."* Every clause of that is a literal feature here, not a slide:

| Bar requirement | How Seam satisfies it |
|---|---|
| **Measured money recovered across a batch** | KPI row computed live from the current batch — ₹ recovered, recovery rate, exposure |
| **Baseline-compared, not just raw recovery** | Evaluation harness: do_nothing / fixed_dunning / seam / max_pressure, common random numbers, incremental recovery is the headline |
| **Compliant escalation** | Opt-outs, contact-frequency caps, and named regulatory constraints (RBI contact hours, e-mandate notice, TRAI DLT templates) |
| **Stopping rules** | 7-rule shield engine, including an economic stopping rule that forces restraint when an action costs more than it could plausibly recover |
| **Audit trail** | Every decision hash-chained — tampering with any past record is provably detectable, not just logged |
| **Honest exceptions** | A dedicated "could not recover" list with reasons, never hidden |

---

## What makes this different from a typical hackathon agent

**Nine things beyond the baseline, each a real feature, not a README claim:**

1. **Decision-source badges** — every single decision, everywhere it renders, is labeled 🤖 AI-proposed / ⚙️ shield-blocked / 📐 heuristic-fallback, so the "LLM never touches money" claim is visible by scrolling, not something you have to take on faith.

2. **Live pause/resume kill switch** — a batch run can be paused between events mid-run, with a visible "Paused — N of M processed" state and nothing silently dropped.

3. **Cash-flow framing** — recovered ₹ translated into "≈N days of reduced receivables outstanding" and "% of at-risk subscription MRR prevented from churning," the language a CFO actually uses.

4. **Per-customer recovery journey** — click any customer and see their whole story as a timeline, not a flat table row.

5. **Counterfactual override sandbox** — try a different action than the one the agent picked, live, against the real shield engine.

6. **Fairness/consistency check** — a statistical check comparing action-assignment rates across language, channel, and tenure segments, reported honestly either way. None of the comparable projects in this track check for this at all.

7. **Promise-to-pay guardrail** — a logged customer commitment defers B2B invoice escalation, but a broken promise explicitly re-allows it rather than pausing forever — asymmetric, not a blunt mute button.

8. **Seed-stability check** — the vs. Baseline comparison re-run across 20 seeds, auto-flagging any metric whose seed-to-seed swing exceeds a stated threshold instead of presenting one point estimate as gospel.

9. **LLM-vs-heuristic agreement** — a live, on-demand check of how often the real LLM's judgment matches the zero-AI fallback's, answering "how much would we actually lose if both providers went down" with data instead of a guess.

---

## Architecture

```
┌─ INGEST ── apps/api/src/ingest/ ──────────── target p99 < 50ms ──┐
│  POST /webhooks/razorpay   → HMAC verify → RawEvent insert → 200 │
│  POST /webhooks/shopify    → HMAC verify → RawEvent insert → 200 │
│  Handler does nothing else. Ever.                                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓ Postgres queue
                (SELECT … FOR UPDATE SKIP LOCKED — src/ingest/claim.ts,
                 proven under real concurrency, not assumed)
┌─ RESOLVE ── apps/api/src/resolve/ ────────────────────────────────┐
│  Shopify checkout → FunnelEvent                                   │
│  Razorpay payment → resolveJoin() → joined PaymentAttempt         │
│  (notes join, confidence 1.0, or the scored fallback — email/     │
│   phone/amount/timestamp — src/join/resolve.ts)                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─ DETECT ── deterministic, no LLM ── src/leaks/classify-checkout.ts┐
│  one classifier: PAYMENT_BLOCKED / ISSUER_DOWNTIME /               │
│  SILENT_ABANDON / PRE_CHECKOUT_DROP — a checkout is provably in   │
│  exactly one of these states, so this is one function, not four   │
└─────────────────────────────────────────────────────────────────┘
                              ↓  only the payment-failure classes
┌─ DIAGNOSE ── src/diagnosis/ ── LangGraph.js, Postgres checkpointer┐
│  ~75% deterministic (classify-diagnosis.ts, pattern-matched over  │
│  Razorpay's own error fields) · the rest: enrich → classify       │
│  (generateObject + Zod schema) → validate → retry (max 2) →       │
│  fail-safe to UNKNOWN_TRANSIENT                                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓  typed Diagnosis
┌─ POLICY ── pure function ── src/policy/decide.ts ─────────────────┐
│  EV = p_recover(diagnosis) × leak_amount − channel_cost           │
│      − annoyance_cost                                             │
│  diagnosis → action is a fixed table. Never a model decision.     │
└─────────────────────────────────────────────────────────────────┘
                              ↓  ProposedAction
┌─ SHIELD ── src/shield/evaluate.ts ── fail-closed, non-overridable ┐
│  7 ordered checks. PASS · BLOCK(reason) · NEEDS_APPROVAL.         │
│  An exception inside Shield produces BLOCK, never PASS — proven   │
│  directly, not assumed from a try/catch existing.                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓  PASS only
┌─ EXECUTE ── src/execute/ ── idempotent ────────────────────────────┐
│  reserve (status-scoped partial unique index) → real Razorpay     │
│  test-mode payment link → simulated SMS/WhatsApp (one shared      │
│  interface) → record                                              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─ LEDGER ── src/ledger/ ── append-only, hash-chained ───────────────┐
│  hash = sha256(prevHash ‖ canonicalJSON(payload))                 │
│  Postgres advisory lock — proven safe under 10 concurrent writes  │
│  GET /ledger/verify recomputes the entire chain, live             │
└─────────────────────────────────────────────────────────────────┘
```

Full design rationale: [`ARCHITECTURE.md`](./ARCHITECTURE.md). Every non-obvious choice and what it beat: [`DECISIONS.md`](./DECISIONS.md).

---

## Beyond the core loop

Real login (JWT-in-httpOnly-cookie), and five features built on top of the pipeline above, each grounded in Seam's own data:

| Feature | What it does |
|---|---|
| **Leak Intelligence** | Daily z-score comparison of each payment method's failure rate against its own 7-day baseline; a method that spikes more than 2σ gets flagged as `METHOD_CONCENTRATION` |
| **Recovery Conversations** | Inbound replies classified (promise / already paid / refuse / opt-out / unclear); refuse/unclear/opt-out open a ticket; opt-outs write to a real `OptOut` table Shield checks before every future contact |
| **Weekly Digest** | Templated founder brief built fresh from a merchant's own leak and recovery history, explicit about predicted EV vs. realised |
| **Analytics Dashboard** | Daily leaked-vs-recovered trend, leak-value-by-cause, payment-method-reliability charts — all real aggregations, no display-layer estimates |
| **Agent Fleet** | Named, honest inventory of 8 automated workers (7 deterministic, 2 LLM-assisted), each with real run history you can click into |
| **Chat with Your Store** | Conversational agent that answers questions about leaks, opportunities, and ledger integrity by calling the same real, tested functions — never authors a number itself |

---

## What's real vs. simulated

| Layer | Status |
|---|---|
| **Razorpay** | Real test-mode API calls (key verification, payment link creation) — no live money anywhere |
| **Shopify** | Real OAuth flow, real webhook HMAC verification |
| **WhatsApp / SMS** | Simulated outbound (behind an interface shaped for one-file real adapter swap) and simulated inbound; everything downstream of "here is the reply text" is real |
| **LLM diagnosis** | Built and tested against a mocked model, *and* run live against a real Groq model — all 7 prompt-injection fixtures plus a plain decline correctly classified |
| **Hash-chained ledger** | Real sha256 chain, real advisory locks, live verification endpoint |

---

## Proof, not claims

**Three-way LLM degradation** — Groq (primary) → Gemini (auto-fallback) → a zero-API-key deterministic heuristic agent if both fail. This has fired for real during development, not just in theory.

**Incremental recovery, not raw** — ~15–20% of at-risk value in this dataset comes back with zero intervention; counting that as the agent's win is the easiest way for a recovery product to flatter itself. The evaluation harness nets it out. Reproduce: `pnpm exec tsx apps/api/scripts/eval-baselines.ts`.

**A seed-stability check on that number** — one seed's comparison could just be lucky. The stability check re-runs the full 4-arm comparison across 20 independent seeds and reports mean/std/coefficient-of-variation per metric, auto-flagging anything whose seed-to-se4ed swing exceeds 25% as noisy.

**LLM-vs-heuristic agreement, not accuracy-against-a-label** — a naive "diagnosis accuracy" eval is meaningless here (the heuristic fallback deliberately just echoes the event's failure code, so it would trivially score 100%). Instead, the agreement check runs the live LLM against the same events the heuristic sees and reports how often their independent judgment actually agrees.

**Hash-chained audit trail** — `pnpm exec tsx apps/api/scripts/verify-ledger.ts` walks the chain and fails loudly at the first tampered record. Proven by a test that tampers with a row on purpose and confirms it's caught at the exact position.

**A real 2am bug, found and fixed** — an early retry executor with no rate limit made recovery worse, not better, caught by the system's own audit trail. Full story: [`LEARNINGS.md`](./LEARNINGS.md).

---

## Tech stack

100% free tier, no paid signups anywhere.

| Layer | Choice |
|---|---|
| **Frontend** | Next.js (App Router) + TypeScript, Tailwind CSS v4, shadcn/ui |
| **Backend** | Hono (TypeScript) + Prisma 7 + Postgres |
| **LLM** | Groq (primary) → Gemini (fallback) → deterministic heuristic (last resort) |
| **Database** | Postgres (Supabase / Neon free tier) |
| **Payments** | Razorpay Test Mode API — real payment links, zero cost |
| **Hosting** | Vercel (frontend), Render free tier (backend) |

---

## Get it running

Requires Node ≥22, pnpm, and a local Postgres.

```bash
git clone https://github.com/WebDevAmey/seam.git
cd seam
pnpm install

# create a local database, then:
cp apps/api/.env.example apps/api/.env
# fill in DATABASE_URL, DATASOURCE_ENC_KEY (any random string for local dev)
# optional: set GROQ_API_KEY to run diagnosis against a real model, and/or
# OPENROUTER_API_KEY to make the chat agent (/recovery/chat) actually respond
# — everything else in this build runs with no key at all

cd apps/api
pnpm db:push
psql "$DATABASE_URL" -f prisma/manual-constraints.sql
pnpm test          # 305 tests, all against a real Postgres instance
pnpm exec tsx --env-file=.env scripts/seed-demo.ts   # seeds a real demo account, prints its login
pnpm dev           # http://localhost:8090

# in a second terminal
cd apps/web
cp .env.example .env.local
# SEAM_API_URL=http://localhost:8090
# JWT_SECRET must be the exact same value as apps/api/.env's JWT_SECRET
pnpm install
pnpm dev           # http://localhost:3000
```

Sign in at `http://localhost:3000/login` with the email/password the seed script printed (`founder@kolamandco.example` / `seamdemo123` by default) to see real generated data — or use `/signup` to create a fresh, empty account.

---

## Repo layout

```
seam/
├── README.md
├── ARCHITECTURE.md          # full system walkthrough, sequence diagram, API reference
├── DECISIONS.md             # every non-obvious choice, its alternative, why it lost
├── EVALUATION.md            # pre-registered metrics, both seeded sets, results
├── LEARNINGS.md             # the real build log — problem statement, every bug
├── LIMITATIONS.md           # every disclosed gap, quantified
├── NOTES.md                 # when the held-out set was opened
├── docs/
│   └── images/              # screenshots used in this README + the blog
├── apps/api/
│   ├── src/ingest/          # webhook receivers, HMAC verification, Postgres queue
│   ├── src/resolve/         # checkout-to-payment join engine
│   ├── src/leaks/           # deterministic leak classifier
│   ├── src/diagnosis/       # LangGraph.js subgraph + rules engine
│   ├── src/policy/          # EV calculation, fixed action table
│   ├── src/shield/          # 7-rule safety gate, fail-closed
│   ├── src/execute/         # idempotent recovery: reserve → link → record
│   ├── src/ledger/          # append-only, hash-chained audit trail
│   ├── src/intelligence/    # z-score method-concentration detection
│   ├── src/digest/          # weekly founder brief
│   ├── src/replies/         # reply classification, tickets, opt-out
│   ├── src/auth/            # JWT signup/login, session middleware
│   ├── src/analytics/       # daily/by-class/by-method aggregations
│   ├── src/agents/          # named agent registry + live-triggerable agents
│   ├── scripts/             # seed-demo.ts + eval scripts
│   └── prisma/              # schema.prisma + manual constraints SQL
├── apps/web/
│   ├── app/page.tsx         # public landing page
│   ├── app/(auth)/          # login, signup
│   ├── app/(app)/recovery/  # dashboard, map, queue, intelligence, digest, tickets, agents, ledger
│   ├── components/          # UI primitives, charts, motion, landing sections
│   └── lib/                 # API client, auth helpers, formatters
└── supabase/migrations/     # SQL schema (if using Supabase)
```

---

## Status & known limits

The full pipeline runs end-to-end against real infrastructure: generate → diagnose (with three-way degradation) → shield-check (7 rules) → execute (real Razorpay Test Mode links, not placeholders) → write a hash-chained decision → push to the live feed.

| Limit | Status |
|---|---|
| **Render cold start** | Free tier spins down after ~15 min idle — hit `/health` a few minutes before judging |
| **Comms channels** | WhatsApp/SMS/email are simulated in-UI, clearly labeled as such |
| **Multi-tenancy** | Single-merchant demo: no auth/multi-tenancy beyond the JWT layer |
| **Hash chain concurrency** | Assumes a single sequential writer — a stated scope cut, not an oversight |
| **POST_PURCHASE_LEAK** | No refund/return data model exists yet — deliberately deferred |

---

## What to read next

- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — the full technical walkthrough: request flow, data model, API surface, sequence diagram.
- [`LEARNINGS.md`](./LEARNINGS.md) — the build story, with the honest failure-and-fix narrative.
- [`EVALUATION.md`](./EVALUATION.md) — pre-registered metrics, both seeded sets, held-out run.
- [`LIMITATIONS.md`](./LIMITATIONS.md) — every disclosed gap, quantified.
