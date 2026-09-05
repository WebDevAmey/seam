# Agents harness

Instructions for any AI coding agent working in this repo (Claude, Codex, Cursor, or otherwise). Read this before making changes.

## What this project is

Seam joins a Shopify store's checkout funnel to its Razorpay payment rail, attributes leaked revenue to a specific cause, and executes bounded, EV-gated recovery on the leaks worth recovering. See `LEARNINGS.md` for the problem statement and the running build log.

## Hard rules — non-negotiable

1. **Never `git push`, and never touch the remote in any way (no force-push, no branch deletion on remote, no direct write to GitHub) without the human explicitly asking for that specific push in that moment.** A prior approval does not carry forward to the next change. Local commits are fine when asked for; the remote is not touched without explicit, fresh instruction.
2. **After every non-trivial change, give a short summary**: what was done, why, the tradeoffs made, and anything learned (including anything that broke and how it got fixed). Keep it tight — a few sentences, not a report.
3. **Log real bugs and non-obvious decisions in `LEARNINGS.md`** as they happen — what broke, why, how it got fixed. That file is the project's memory; keep it honest and keep it current.
4. **No branding or code from any other product in this repo, except the landing page.** Seam's product and console are a standalone build. The one disclosed, deliberate exception is `apps/web/app/page.tsx` and `components/landing/`, which reuse Ovrt's real components and layout on the repo owner's own explicit, informed instruction — see `DECISIONS.md`'s landing-page entry for the full reasoning and what was and wasn't carried over (code and motion, yes; copy, screenshots, and personal contact info, no). Everywhere else in the repo, the original rule stands: if a pattern is informed by something observed elsewhere, describe the pattern and its rationale on its own technical merits, don't name the source.
5. **Write tests before implementation for pure functions** (crypto, HMAC verification, policy/EV math, the queue-claim logic) — this codebase has already caught two real bugs this way (a stale Prisma client, a broken tamper-test) and it's cheaper to catch the third one the same way.
6. **Don't add abstractions, config flags, or error handling for cases that can't happen.** Three similar lines beat a premature helper. Trust the framework and the database's own guarantees; validate only at real boundaries (webhook payloads, user input).

## Structure

A pnpm workspace, two apps. Every feature lives in exactly one module on the backend and is surfaced through exactly one route group on the frontend — if you're looking for where something lives, this is the map.

```
apps/api/src/            Hono + TypeScript + Prisma 7 + Postgres — all backend logic
  agents/                 the agent registry + harness + every live-triggerable agent
    chat/                   "chat with your store" — tool-calling LLM agent, OpenRouter
  analytics/              dashboard trend/leak-value/method-reliability aggregations
  auth/                   signup/login/session, JWT-in-httpOnly-cookie
  diagnosis/              decline classification: rules first, LangGraph+LLM (Groq) fallback
  digest/                 the weekly founder-brief narrative builder
  execute/                reserve → dispatch → record; approve/reject; the Razorpay payment link
  generator/              synthetic data generators, used by seed-demo.ts and the eval scripts
  ingest/                 Shopify/Razorpay webhook receivers (HMAC-verified)
  intelligence/           method-concentration (z-score) leak detection
  internal/               ops endpoints (health, the sweep trigger)
  join/, resolve/         the checkout↔payment join engine (deterministic + scored fallback)
  leaks/                  the leak detector and its read routes
  ledger/                 the hash-chained, append-only audit ledger
  llm/                    single source of truth for which model backs which agent
  merchants/              merchant-scoped read routes
  policy/                 decide(): diagnosis → proposed action + EV, PRD's fixed table
  replies/                inbound reply classification, tickets, opt-outs
  shield/                 the seven-check gate between any action and a real customer
apps/api/scripts/        seed-demo.ts (real pipeline, real demo data) + the eval/report scripts
apps/api/prisma/         schema.prisma + the one raw-SQL constraint Prisma can't express

apps/web/app/
  (auth)/                 login, signup — unauthenticated
  (app)/recovery/         everything behind a session: overview, map, queue, agents,
                          intelligence, tickets, digest, ledger, chat — one folder per page
  page.tsx                the public landing page (Ovrt-derived — see DECISIONS.md)
apps/web/components/
  ui/                     shadcn-registry primitives (beUI, Vengeance UI, Magic UI) + first-party ones
  agents/                 chat/tool-result/message primitives shared across the console
  motion/                 lower-level animation primitives those are built on
  landing/                the marketing page's own components, kept separate from the console
  charts/                 Recharts wrappers + shared color tokens
apps/web/lib/             the typed API client, server actions, auth/session helpers

LEARNINGS.md   the running build log — public, part of the repo
LIMITATIONS.md every disclosed gap, quantified where possible
DECISIONS.md   real decisions this build made, with the real alternatives considered
NOTES.md       the one thing that has to be timestamped honestly (when held-out was opened)
PRD.md         private planning doc — gitignored, never committed, never referenced in public docs
```

## Running things (`apps/api`)

- `pnpm install` at the repo root (pnpm workspace, not per-app)
- `pnpm --filter @seam/api dev` — dev server with hot reload (reads `.env`)
- `pnpm --filter @seam/api test` — vitest, all tests must pass before calling a change done
- `pnpm --filter @seam/api typecheck` — must be clean before calling a change done
- `pnpm --filter @seam/api db:push` — pushes `prisma/schema.prisma` **and regenerates the client** (chained on purpose — see `LEARNINGS.md`)
- **Run `npx prisma generate` (from `apps/api`) after any root-level `pnpm install`**, not just after touching `schema.prisma` — adding or changing a *sibling* workspace package's dependencies can shift where pnpm resolves the generated Prisma client to, silently orphaning the old one. Symptom: every DB-touching test fails with `Cannot find module '.prisma/client/default'`. Seen three times now for three different triggers — see `LEARNINGS.md`.
- `psql "$DATABASE_URL" -f apps/api/prisma/manual-constraints.sql` — **run this once after every fresh `db:push` against a new database** (a teammate's machine, Neon, Render). It adds constraints Prisma 7 can't express natively (currently: `Leak.evidenceEventIds` can never be empty). Safe to re-run.

Local dev needs Postgres running and a `DATABASE_URL` + `DATASOURCE_ENC_KEY` in `apps/api/.env` (see `.env.example`).

`GROQ_API_KEY` (diagnosis) and `OPENROUTER_API_KEY` (chat) are optional — both LLM-assisted paths degrade to a clear, disclosed "not configured" state without them; nothing else in the build needs a key at all.

## Running things (`apps/web`)

- `pnpm --filter @seam/web dev` — Next.js dev server, Turbopack, `http://localhost:3000`
- No test suite on this side — verified by typecheck (`pnpm --filter @seam/web typecheck`) plus live-checking real pages against a running `apps/api`, not by a unit-test runner. Never declare a frontend change done from a clean typecheck alone.
- `apps/api/scripts/seed-demo.ts` is what gives the frontend anything to render locally — run it (from `apps/api`, with `--env-file=.env`) after a fresh `db:push`, or whenever you want a clean, fully-populated demo dataset again.

## Stack choices already made — don't relitigate without a real reason

- Postgres is the queue (`FOR UPDATE SKIP LOCKED`), not Redis or a message broker.
- LangGraph.js is used for exactly one subgraph (the diagnosis step) with a Postgres checkpointer — not the whole pipeline.
- Encryption at rest is AES-256-GCM via `apps/api/src/lib/crypto.ts`, envelope format `v1:<iv>:<tag>:<data>`.
- Razorpay connect is a pasted Key ID + Key Secret, verified live against Razorpay's API — not OAuth (Razorpay has no merchant-facing OAuth).
