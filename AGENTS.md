# Agents harness

Instructions for any AI coding agent working in this repo (Claude, Codex, Cursor, or otherwise). Read this before making changes.

## What this project is

Seam joins a Shopify store's checkout funnel to its Razorpay payment rail, attributes leaked revenue to a specific cause, and executes bounded, EV-gated recovery on the leaks worth recovering. See `LEARNINGS.md` for the problem statement and the running build log.

## Hard rules — non-negotiable

1. **Never `git push`, and never touch the remote in any way (no force-push, no branch deletion on remote, no direct write to GitHub) without the human explicitly asking for that specific push in that moment.** A prior approval does not carry forward to the next change. Local commits are fine when asked for; the remote is not touched without explicit, fresh instruction.
2. **After every non-trivial change, give a short summary**: what was done, why, the tradeoffs made, and anything learned (including anything that broke and how it got fixed). Keep it tight — a few sentences, not a report.
3. **Log real bugs and non-obvious decisions in `LEARNINGS.md`** as they happen — what broke, why, how it got fixed. That file is the project's memory; keep it honest and keep it current.
4. **No branding or code from any other product in this repo.** Seam is a standalone build. If a pattern is informed by something observed elsewhere, describe the pattern and its rationale on its own technical merits — don't name the source.
5. **Write tests before implementation for pure functions** (crypto, HMAC verification, policy/EV math, the queue-claim logic) — this codebase has already caught two real bugs this way (a stale Prisma client, a broken tamper-test) and it's cheaper to catch the third one the same way.
6. **Don't add abstractions, config flags, or error handling for cases that can't happen.** Three similar lines beat a premature helper. Trust the framework and the database's own guarantees; validate only at real boundaries (webhook payloads, user input).

## Structure

```
apps/
  api/    Hono + TypeScript + Prisma 7 + Postgres. All backend logic lives here.
  web/    Next.js frontend — not started yet.
LEARNINGS.md   the running build log — public, part of the repo
PRD.md         private planning doc — gitignored, never committed, never referenced in public docs
```

## Running things (`apps/api`)

- `pnpm install` at the repo root (pnpm workspace, not per-app)
- `pnpm --filter @seam/api dev` — dev server with hot reload (reads `.env`)
- `pnpm --filter @seam/api test` — vitest, all tests must pass before calling a change done
- `pnpm --filter @seam/api typecheck` — must be clean before calling a change done
- `pnpm --filter @seam/api db:push` — pushes `prisma/schema.prisma` **and regenerates the client** (chained on purpose — see `LEARNINGS.md`)
- `psql "$DATABASE_URL" -f apps/api/prisma/manual-constraints.sql` — **run this once after every fresh `db:push` against a new database** (a teammate's machine, Neon, Render). It adds constraints Prisma 7 can't express natively (currently: `Leak.evidenceEventIds` can never be empty). Safe to re-run.

Local dev needs Postgres running and a `DATABASE_URL` + `DATASOURCE_ENC_KEY` in `apps/api/.env` (see `.env.example`).

## Stack choices already made — don't relitigate without a real reason

- Postgres is the queue (`FOR UPDATE SKIP LOCKED`), not Redis or a message broker.
- LangGraph.js is used for exactly one subgraph (the diagnosis step) with a Postgres checkpointer — not the whole pipeline.
- Encryption at rest is AES-256-GCM via `apps/api/src/lib/crypto.ts`, envelope format `v1:<iv>:<tag>:<data>`.
- Razorpay connect is a pasted Key ID + Key Secret, verified live against Razorpay's API — not OAuth (Razorpay has no merchant-facing OAuth).
