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

## What's real vs. simulated

- Razorpay: real test-mode API calls (key verification, payment link creation) — no live money anywhere.
- Shopify: real OAuth flow, real webhook HMAC verification.
- WhatsApp and SMS: simulated, behind an interface shaped so a real adapter is a one-file swap. Said plainly, not implied otherwise.
- The LLM diagnosis path: fully built and tested against a mocked model — there's no live API key configured for this project, so it's never been exercised against a real model. Disclosed in [`LIMITATIONS.md`](./LIMITATIONS.md), not hidden.

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

cd apps/api
pnpm db:push
psql "$DATABASE_URL" -f prisma/manual-constraints.sql
pnpm test          # 169 tests, all against a real Postgres instance
pnpm dev           # http://localhost:8090

# in a second terminal
cd apps/web
cp .env.example .env.local
# SEAM_API_URL=http://localhost:8090, SEAM_DEMO_MERCHANT_ID=<seed one first>
pnpm install
pnpm dev           # http://localhost:3000
```

To see real (synthetic, not fabricated) data on the three screens:

```bash
cd apps/api
pnpm exec tsx --env-file=.env scripts/seed-demo.ts
# copy the printed merchant id into apps/web/.env.local as SEAM_DEMO_MERCHANT_ID
```

## What's new vs. what's a deliberate scope cut

This is a standalone build, written from scratch — see [`LEARNINGS.md`](./LEARNINGS.md) for the full account, including the two things deliberately deferred (`METHOD_CONCENTRATION` and `POST_PURCHASE_LEAK` leak classes — no 14-day baseline data and no refund model exist yet, respectively) and every real bug hit and fixed along the way.

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
| `apps/web` | Next.js frontend |
