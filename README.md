# Seam

Razorpay AI Buildathon 2026 — Track 05 (Open)

## The problem

A D2C merchant's revenue moves through one funnel: someone browses, adds to cart, starts checkout, attempts to pay, and — if everything goes right — the order gets fulfilled. That funnel is watched by two systems that share no customer identity with each other. The storefront platform (Shopify) sees the shopping behavior. The payment gateway (Razorpay) sees the money moving. Neither one sees both halves.

So when a founder asks the only question they actually care about — *"revenue dropped ₹2L yesterday, why?"* — both systems give a half-answer. The storefront says checkout abandonment spiked; it has no idea those customers actually tried to pay and were declined. The gateway says `payment.failed` fired 214 times; it has no idea those were ₹12,000 carts from repeat customers who all came from one ad campaign.

Every "recover my failed payments" tool starts at the payment event — the one half the gateway can see. That makes them all blind to the larger, more common category of leak: money lost *before* a payment is ever attempted, or lost *after* it succeeds. Treating "revenue leak" as a synonym for "payment failure" is why merchants keep fixing the visible, cheap problem and missing the expensive, invisible one.

**Seam joins the two systems at the one place they can actually be joined — the checkout — attributes every rupee of leaked revenue to a specific cause, and executes bounded, EV-gated recovery on the leaks worth recovering, behind a deterministic gate a language model can never talk its way around.**

Full origin story, the build log, and every real bug hit along the way: [`LEARNINGS.md`](./LEARNINGS.md).

## Why Open Track, not Track 01 or 03

Track 03 scores money recovered from payment failures. Seam recovers those too, but the claim is larger: most revenue leak isn't a payment failure, and treating it as one is why merchants keep chasing the wrong problem. A payment-recovery agent that recovers ₹40k while the merchant loses ₹3L to a shipping-cost surprise on the checkout page has solved the visible problem and missed the expensive one. That doesn't fit inside a track whose scope begins at the payment event.

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

## Beyond the core loop

Real login (JWT-in-httpOnly-cookie, adapted from a generic auth pattern — see `DECISIONS.md`), and three features built on top of the pipeline above, each grounded in Seam's own data rather than requiring credentials this build doesn't have:

- **Leak intelligence** (`apps/api/src/intelligence/`, `/recovery/intelligence`) — a daily z-score comparison of each payment method's failure rate against its own 7-day baseline; a method that spikes more than 2σ above normal gets flagged as a `METHOD_CONCENTRATION` leak, often the first sign of an issuer- or gateway-side problem.
- **Recovery conversations** (`apps/api/src/replies/`, `/recovery/tickets`) — inbound replies to a recovery message get classified (promise to pay / already paid / refuse / opt-out / unclear); refuse/unclear/opt-out open a ticket for a human, and an opt-out is written to a real `OptOut` table that Shield checks before every future contact attempt.
- **Weekly digest** (`apps/api/src/digest/`, `/recovery/digest`) — a templated founder brief built fresh from a merchant's own leak and recovery history for any period, explicit about which figures are predicted EV versus realised.
- **Analytics dashboard** (`apps/api/src/analytics/`, `/recovery`) — daily leaked-vs-recovered trend, leak-value-by-cause, and payment-method-reliability charts (Recharts), all real aggregations over a merchant's own rows, no display-layer estimates.
- **Agent fleet** (`apps/api/src/agents/`, `/recovery/agents`) — a named, honest inventory of Seam's automated workers (detector, diagnosis, policy, shield, executor, leak intelligence, reply classifier, digest, chat — seven deterministic, two LLM-assisted), each backed by a real harness (`agents/harness.ts`) that records every run's actual input/output — click into any agent to see its real run history, not a simulated activity count, plus a real success-rate bar. Detector, diagnosis, the recovery executor, Shield, and the Opportunities Agent are all live-triggerable from their own pages, and a single **"Run all agents"** button sweeps them in dependency order. The **Recovery Executor** runs the real Policy + Shield decision path over every unaddressed leak and reserves (or blocks) a real recovery action for each one; it stops short of actually dispatching, because that needs a merchant's connected Razorpay credentials, which nothing in this build has (see `LIMITATIONS.md` §10, §13).
- **Chat with your store** (`apps/api/src/agents/chat/`, `/recovery/chat`) — a conversational agent (OpenRouter via the Vercel AI SDK's tool-calling, `OPENROUTER_API_KEY` required — see `src/llm/providers.ts`) that answers questions about a merchant's own leaks, opportunities, open conversations, and ledger integrity by calling the same real, tested functions every other agent uses — never authors a number itself, and has no write/dispatch tool available to it (`LIMITATIONS.md` §12). UI built on real [beUI](https://beui.dev) components (`message`, `prompt-input`, `tool-result`, `thinking-shimmer`) pulled via the shadcn registry.

## What's real vs. simulated

- Razorpay: real test-mode API calls (key verification, payment link creation) — no live money anywhere.
- Shopify: real OAuth flow, real webhook HMAC verification.
- WhatsApp and SMS: simulated, both outbound (behind an interface shaped so a real adapter is a one-file swap) and inbound (a reply endpoint stands in for a real webhook) — everything downstream of "here is the reply text," including classification, ticketing, and opt-out, is real.
- The LLM diagnosis path: built and tested against a mocked model, *and* run live against a real Groq model (`classify-with-openai.live.test.ts`) — all 7 prompt-injection fixtures plus a plain decline correctly classified. A real, specific result on this build's own fixture set, not a general claim about detection quality at scale. Full detail in [`LIMITATIONS.md`](./LIMITATIONS.md) §4.

## Measured results

Full methodology, both seeded sets, and the held-out run: [`EVALUATION.md`](./EVALUATION.md).

- **Leak detection:** precision 1.000, recall 1.000, all four detectable classes, on both the dev and held-out seeded sets.
- **Join engine (scored fallback):** precision 1.000 (never once joins the wrong checkout). Recall 0.333 — with the full breakdown in `EVALUATION.md` on why that's not actually a problem: a third of the eval's scenarios are deliberately in the "correctly held as ambiguous, not actioned" safety zone by construction.
- **Baselines:** does **not** cleanly beat `blast_everything` (message everyone, no gating) on raw net value in this run — and that's reported honestly rather than tuned away. The full explanation is in `EVALUATION.md`: every rupee of the gap traces to Shield correctly holding back a specific action (one for human approval, one below the profitability floor) that the naive strategy would have fired blindly.
- **Failure injection:** all six PRD-named scenarios proven, live-runnable in one place: `pnpm exec tsx apps/api/scripts/failure-injection-report.ts`.

## Setup

Requires Node ≥22, pnpm, and a local Postgres.

```bash
git clone <this repo>
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
pnpm test          # 305 tests (9 auto-skip without GROQ_API_KEY / OPENROUTER_API_KEY), all against a real Postgres instance
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

## What's new vs. what's a deliberate scope cut

The application — every backend pipeline stage, the agent fleet, the auth, the dashboard — is a standalone build, written from scratch for this buildathon. The one exception, on explicit instruction: the marketing landing page's structure, motion, and component architecture is adapted from [Ovrt](https://github.com/WebDevAmey/Ovrt) (`ovrt.in`), the same team's other project — copy rewritten for Seam, the accent recolored to supermemory.ai's blue, real product screenshots replaced with illustrative mockups of Seam's own concepts. See `DECISIONS.md` and `LEARNINGS.md` for the full account, including the one thing still deliberately deferred in the actual product (`POST_PURCHASE_LEAK` — no refund/return data model exists yet) and every real bug hit and fixed along the way.

## Repo map

| File | What it is |
|---|---|
| `README.md` | this file |
| `ARCHITECTURE.md` | standalone design rationale |
| `DECISIONS.md` | every non-obvious choice, its alternative, why it lost |
| `EVALUATION.md` | pre-registered metrics, both seeded sets, results |
| `LEARNINGS.md` | the real build log — problem statement, decisions, every bug |
| `NOTES.md` | when the held-out set was opened |
| `LIMITATIONS.md` | every disclosed gap, quantified |
| `AGENTS.md` | rules for any AI agent working in this repo |
| `apps/api` | Hono + TypeScript + Prisma 7 + Postgres backend |
| `apps/api/src/intelligence` | leak intelligence — z-score method-concentration detection |
| `apps/api/src/digest` | weekly digest — the founder brief |
| `apps/api/src/replies` | reply classification, tickets, opt-out |
| `apps/api/src/auth` | signup/login (JWT issuing, real DB access), and the `requireOwnMerchant`/`requireSession` middleware every merchant-scoped route sits behind |
| `apps/api/src/analytics` | real daily/by-class/by-method aggregations powering the dashboard's charts |
| `apps/api/src/agents` | the named agent registry and the Opportunities Agent's live dry-run decisions |
| `apps/web` | Next.js frontend |
