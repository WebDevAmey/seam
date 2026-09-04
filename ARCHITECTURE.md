# Architecture

## The pipeline

Ingest → Resolve → Detect → Diagnose → Policy → Shield → Execute → Ledger. Each stage is a separate module with a narrow job; nothing upstream knows how anything downstream works. The README has the full diagram with file paths — this document is the reasoning behind the shape.

## Six properties, and why each one is load-bearing

**1. Webhook handlers do nothing but verify and insert.** `POST /webhooks/razorpay` and `POST /webhooks/shopify` (`apps/api/src/ingest/`) check the HMAC signature, insert one row into `RawEvent`, and return 200. No joining, no classification, no side effects. This bounds ingest latency to the cost of one insert and means a slow downstream stage can never make a webhook provider start retrying (or worse, disabling) delivery.

**2. `RawEvent` is append-only, so all derived state is rebuildable from raw.** Every `FunnelEvent`, `PaymentAttempt`, `Leak`, and `RecoveryAction` is *derived* from `RawEvent` rows via the resolve/detect/execute pipeline. If a bug corrupts derived state, the fix is to reprocess `RawEvent` from the beginning, not to reconstruct history from whatever's left. This is the actual durability story, not a backup policy.

**3. Postgres is the queue.** `claimUnprocessedRawEvents` (`apps/api/src/ingest/claim.ts`) uses `SELECT ... FOR UPDATE SKIP LOCKED` so N concurrent workers can each claim a disjoint batch of unprocessed rows with no coordination beyond the database itself. No Redis, no message broker — one fewer service, one fewer failure mode, and one less thing to keep consistent with the source of truth. Proven under real concurrency: `claim.test.ts` fires 6 simulated workers at 12 rows simultaneously and asserts zero overlap, zero drops.

**4. Idempotency is a database constraint, not application discipline.** `RecoveryAction`'s uniqueness isn't a flat `UNIQUE` — it's a partial unique index (`prisma/manual-constraints.sql`) scoped to `state IN ('RESERVED', 'DISPATCHED')`. That's a deliberate distinction: a `FAILED` attempt has to *not* count against the constraint, or a single transient failure would permanently block ever retrying that (merchant, checkout, action class) combination. `reserve-action.test.ts` proves both halves — 10 concurrent identical reservations produce exactly one winner, and a `FAILED` row doesn't block a fresh attempt while a `DISPATCHED` one still does.

**5. Shield is downstream of Policy and cannot be invoked by it.** `decide()` (`apps/api/src/policy/decide.ts`) never calls `evaluateShield()` — the executor calls Policy, gets a `ProposedAction`, and *then* calls Shield. A bug in Policy's EV arithmetic can produce a bad `ProposedAction`, but it can't route around Shield's checks, because there's no code path where Policy has the authority to skip them. Shield itself is fail-closed by construction: `evaluate.test.ts` proves an exception thrown mid-check produces `BLOCK`, not `PASS`, by actually triggering a real exception and asserting the outcome — not by inspecting a `try/catch` and trusting it.

**6. The diagnosis subgraph is crash-resumable, proven, not assumed.** The one non-deterministic node in this system (the LLM-backed classifier) runs inside a LangGraph.js `StateGraph` with a Postgres-backed checkpointer, in its own `langgraph` schema — verified to have zero table overlap with Prisma's own schema by inspecting the actual database, not by reading documentation. `graph.test.ts` proves this two ways: a generic proof (a two-node graph, an interrupted run, a fresh instance resuming) and a graph-specific one (the real diagnosis state machine, paused mid-retry-loop via `interruptAfter`, resumed by a fresh graph instance that continues directly into round 2 without re-running round 1).

## Why a trust boundary, and where exactly it sits

The LLM never authors an amount, a link, or a deadline into anything a customer sees. Concretely: `phrasingFor()` (`apps/api/src/execute/compose-message.ts`) returns fixed template text with no digits, no `₹`, no URL — verified directly by a test that checks every template against that exact pattern. The real payment link is injected *after* that text is chosen, by `composeMessage()`, never by anything the model authored. On the diagnosis side, `validateDiagnosisOutput()` (`apps/api/src/diagnosis/validate-output.ts`) enforces the same rule on the model's free-text `reasoning` field, plus a second, independent check: every evidence event ID the model cites has to actually exist in the database, or the output is rejected regardless of how well-formed it looks. Two separate mechanisms, because they're protecting against two separate failure modes — content injection, and hallucinated evidence.

Prompt injection gets the same trust-boundary treatment as fraud: `PROMPT_INJECTION_SUSPECTED` routes through the identical code path as `SUSPECTED_FRAUD` in Policy's fixed diagnosis→action table (`ESCALATE_NEVER_CONTACT` in `decide.ts`) — always `HOLD_AND_ESCALATE`, zero EV arithmetic, no customer contact, regardless of amount. `injection-fixtures.test.ts` proves this for every attack fixture directly, not by inference.

## Data model

`RawEvent` → `FunnelEvent` / `PaymentAttempt` (joined via `resolveJoin`) → `Leak` → `Diagnosis` (implicit in the classifier's output, not separately persisted in this build) → `RecoveryAction` → `LedgerEntry`. Every table that has a natural tenant boundary carries `merchantId` from line one — not a retrofit. Full schema: `apps/api/prisma/schema.prisma`.

Two constraints live outside Prisma's schema DSL entirely, in `apps/api/prisma/manual-constraints.sql`, because Prisma 7 can't express either natively: the `RecoveryAction` partial unique index (property 4, above), and a `CHECK (cardinality(evidenceEventIds) > 0)` on `Leak` — a second, independent line of defense on top of the already-tested application-level guarantee that a leak is never written without evidence.

## What's deliberately not here

`METHOD_CONCENTRATION` and `POST_PURCHASE_LEAK` are named in the leak taxonomy but have no detector — the former needs a multi-day baseline to compute a deviation against, the latter needs a refund/return data model, and building either now would mean guessing at a shape before the thing that needs it exists. There's no outcome-attribution worker, so every recovery figure this system reports is predicted expected value, not observed realised recovery. Both are disclosed in full, with the reasoning, in `LIMITATIONS.md` — not omitted from this document to make the architecture look more finished than it is.
