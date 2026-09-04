# Learnings

An honest, running account of building Seam: the real problem we set out to solve, what we decided and why, what broke, and how we fixed it. Written as we go — not reconstructed afterward to look tidier than it was.

---

## The problem

A D2C merchant's revenue moves through one funnel: someone browses, adds to cart, starts checkout, attempts to pay, and — if everything goes right — the order gets fulfilled. That funnel is watched by two systems that share no customer identity with each other. The storefront platform (Shopify) sees the shopping behavior. The payment gateway (Razorpay) sees the money moving. Neither one sees both halves.

So when a founder asks the only question they actually care about — *"revenue dropped ₹2L yesterday, why?"* — both systems give a half-answer:

- The storefront says checkout abandonment spiked 40%. It has no idea those customers actually tried to pay and were declined.
- The gateway says `payment.failed` fired 214 times. It has no idea those were ₹12,000 carts from repeat customers who all came from one ad campaign.

Every "recover my failed payments" tool we could find starts at the payment event — the one half the gateway can see. That makes them all blind to the larger, more common category of leak: money lost *before* a payment is ever attempted (a shipping-cost surprise at checkout, a broken step, a slow page) or lost *after* it succeeds (refunds, returns). Treating "revenue leak" as a synonym for "payment failure" is exactly why merchants keep fixing the visible, cheap problem and missing the expensive, invisible one.

## Our approach

Join the two systems at the one place they can actually be joined — the checkout — by carrying a Shopify checkout ID through Razorpay's `notes` field into the payment record, with a scored fallback (email, phone, amount, timestamp) for stores that haven't wired the deterministic join. Once joined, classify every rupee of leak into one of a fixed set of causes, compute whether recovering it is worth the cost of trying — expected value, not gut feel — and only act on the leaks that clear that bar, through a deterministic gate a language model can never talk its way around.

Full spec lives in the private planning doc (not in this repo); this file is the log of what actually happened building it.

---

## Build log

### Project setup — fresh standalone repo
**What:** stood up `apps/api` (Hono + TypeScript + Prisma 7 + Postgres) as its own pnpm workspace, with nothing shared with any other codebase.
**Why:** a clean, fully-owned build we can reason about end to end, rather than a fork of something else's history.
**Tradeoff:** no inherited auth, OAuth, or UI shell to lean on — everything gets built from scratch, on purpose.

### Bug — Prisma client silently stale after a schema change
**What broke:** added a `processedAt` column to `RawEvent`, ran `prisma db push`, and the generated client still didn't know the field existed — every query using it failed with "Unknown argument."
**Why:** `db push` syncs the database but doesn't reliably regenerate the TypeScript client on its own.
**Fix:** run `prisma generate` explicitly after every schema change. The `db:push` script now always chains `prisma db push && prisma generate` so this can't be forgotten again.

### Bug — a "tampered ciphertext" test that wasn't actually testing tampering
**What broke:** a test asserting that decrypting a tampered AES-256-GCM ciphertext throws — it didn't throw, and the encryption looked broken.
**Why:** the test tampered by appending a character to the base64-encoded ciphertext. Base64 decoding is lenient about trailing characters, so the "tampered" string decoded back to the *same* bytes as the original — the encryption was fine, the test was wrong.
**Fix:** tamper at the byte level (flip one bit in the decoded buffer, then re-encode) instead of the text level. Worth remembering generally: string-level mutation of an encoded value doesn't reliably mutate the underlying bytes.
**Learning:** a failing assertion isn't proof the implementation is wrong — the checkpointer test suite caught this because we wrote the test *before* assuming what "tampered" should look like.

### Bug — hit an unrelated local service instead of our own
**What broke:** an early smoke test curled `localhost:8080/health` and got back an Apache Tomcat 404 page instead of our own server's response.
**Why:** two compounding mistakes — the shell had no `timeout` binary (not present on macOS by default, so a `timeout 6 ... &` command silently failed to even start our server), and port 8080 was already occupied locally by an unrelated Java/Tomcat process.
**Fix:** moved the dev server to port 8090, and switched to running background processes through a tracked mechanism instead of a bare `&` subshell so failures are visible instead of silent.

### Learning — LangGraph.js's Postgres checkpointer needed proving, not assuming
Before writing any pipeline code, we tested whether LangGraph.js's Postgres-backed checkpointer actually gives crash-resumable runs against the *same* database our own ORM manages. It does — and it keeps its own tables in a separate Postgres schema by explicit configuration, so there's zero collision risk with our application tables. Confirmed with a real test: a two-node graph, a simulated crash after the first node completes, and a fresh graph instance (standing in for a new process) that resumes and completes without re-running the first node. Proven before it became load-bearing, not assumed.

### Learning — Razorpay has no merchant-facing OAuth
Shopify apps get a real OAuth redirect flow; Razorpay does not offer the equivalent for ordinary merchants — its OAuth product requires partner approval. The realistic pattern (and what real Razorpay integrations actually do in test mode) is the merchant pasting their Key ID and Key Secret directly. We verify those are real by making one authenticated call to Razorpay's API before ever encrypting and storing them — so a typo or a revoked key is caught at connect time, not the first time a webhook needs it.

### Bug — a test that passed alone and failed as part of the full suite
**What broke:** the Shopify webhook tests passed running on their own, then failed with "expected undefined" when run alongside every other test.
**Why:** the test payloads used fixed order ids (1001, 1002, ...) to build the dedup key (`source` + `externalId`). That key is unique across the *whole* database, and the local dev Postgres instance persists between test runs — so a second run's "new" order 1001 collided with the row a previous run had already inserted for a different merchant. Prisma's `upsert` quietly took the "already exists, no-op" branch instead of creating a fresh row, so the new test's merchant never got its event.
**Fix:** generate a fresh random id per test run instead of a fixed literal, matching the pattern the Razorpay webhook tests already used.
**Learning:** a fixed literal in a test is only safe if the database gets reset between runs. Ours doesn't (real Postgres, not a fresh sandbox per test), so every test that writes rows needs to generate its own unique inputs — and "passes in isolation" is not the same guarantee as "passes as part of the suite."

### Bug — a flaky test caused by a *correct* design decision
**What broke:** the queue-claim concurrency test (6 workers racing over 12 rows) started intermittently claiming only 2 of its 12 rows once a second test file (`/internal/sweep`) also started claiming from the same table.
**Why:** `claimUnprocessedRawEvents` claims globally across every merchant — correct for production, since a sweep has to drain *all* pending work, not just one merchant's. But vitest runs test files in parallel by default, so two files both pulling from the same real, shared queue table started competing for each other's rows.
**Fix:** turned off file-level parallelism in `vitest.config.ts` rather than artificially scoping the claim query to make tests convenient — the query being global is correct; the tests running concurrently against a shared real table was the actual problem. Confirmed with three back-to-back full-suite runs, not one lucky pass.

### Decision — the join scorer is a pure function, deliberately decoupled from the database
**What:** `resolveJoin(payment, candidates)` takes plain objects in, returns a plain result out — no Prisma import, no I/O.
**Why:** this is the actual differentiator (most competing approaches never join the two data sources at all), so it needs to be provably correct on its own, independent of how candidates get fetched. All 9 tests run in milliseconds with no database.
**Learning:** floating-point addition needed a rounding guard (`0.40 + 0.35` can print as `0.7499999999999999` in JS) — rounding to 2 decimal places after summing avoids a boundary case (exactly 0.75) silently landing on the wrong side of the accept/ambiguous line.

### Bug — a schema gap that made a whole leak class undetectable
**What broke:** nothing crashed, but while writing the generator's test for `ISSUER_DOWNTIME` (a payment failure that overlaps an issuer/network outage), there was no field anywhere recording *when* a payment attempt actually happened.
**Why:** `PaymentAttempt` had every field from the PRD's original sketch except a timestamp — an oversight that's easy to miss until you try to answer "did this failure happen during the outage," which is the entire definition of that leak class.
**Fix:** added `attemptedAt` to `PaymentAttempt`, populated from the real payment's own timestamp during resolve (not `now()` at insert time — a delayed sweep shouldn't shift when the panel thinks the failure occurred).
**Learning:** the second schema gap caught this way (after `RawEvent.processedAt`). Both were found by trying to actually implement or test the behavior the field was needed for, not by re-reading the spec harder — worth remembering as the detectors and eval harness get built next.

### Learning — proving crash-resumability properly needed the right LangGraph primitive, not a forced simulation
The Block 1 proof faked a crash by throwing an error inside a node. That doesn't work for the real diagnosis graph, because its `classify` node deliberately catches every error from the model call (a malformed response is an expected outcome, not a crash — it's what triggers a retry). A first attempt at simulating a crash with an `AbortController` raced against the graph's own internal continuation and aborted a step too late. The actual right tool was `interruptAfter` at compile time — LangGraph's own mechanism for pausing a run right after a checkpoint commits, without throwing anything. That's not a lesser proof: a fresh process resuming a thread has no way to distinguish "the run was paused" from "the old process died" — the checkpoint on disk is identical either way, so proving resumption from an interrupt proves resumption from a crash.

### Decision — the injection fixtures prove the safety path, not detection quality
There's no OpenAI API key configured for this project, so nothing here can prove a live model actually recognizes every fixture in `injection-fixtures.ts` as an attack — that would need real credentials and is a model-quality question, not a code-correctness one. What's genuinely provable without a live model, and is proven directly: *if* a diagnosis comes back `PROMPT_INJECTION_SUSPECTED` — correctly detected or not — the system routes it through the identical path as `SUSPECTED_FRAUD`: escalated to a human, never auto-actioned, no exceptions. That's the claim that actually matters for safety, and it doesn't need a model call to verify.

### Decision — no real WhatsApp adapter for this build, and that's a change from the earlier plan
Early in this project's planning, a real WhatsApp Business Cloud API adapter looked reusable from the private reference system studied for precedent. That's no longer available — Seam is a standalone build with its own credentials, and it doesn't have a Meta Business app. Both SMS and WhatsApp are simulated executors behind one `ChannelAdapter` interface, exactly as the PRD's own "what we deliberately do not build" section already anticipated as the honest fallback. Swapping in a real adapter later is a one-file change, not a rearchitecture — the interface is already shaped for it.

### Decision — the idempotency reservation sits between Shield's stateless checks and dispatch, not inside evaluateShield itself
The PRD's Shield ordering names the reservation as check 6, between the daily-outreach cap and the content validator. `evaluateShield` stayed a pure function (no DB access, by design — see the Block 5 entry on why that mattered for testing). The reservation itself is real, impure, DB-touching work, so it lives in the executor, called right after Shield passes and right before any expensive work (a real Razorpay API call) happens — which is the actual intent behind "reserve before the LLM runs": lock in the idempotency guarantee before spending anything, not literally inline inside a stateless function.

### Bug — the detector was right, the ground truth was wrong
**What broke:** a checkout the generator labelled `PAYMENT_BLOCKED` in its ground truth got classified by the detector as `ISSUER_DOWNTIME` instead — looked at first like a detector bug.
**Why:** the generator picks a random payment method and a random time-of-day independently for every checkout, including `PAYMENT_BLOCKED` ones. By chance, one landed on the same method and time window as the synthetic downtime outage — which, by the actual rule ("`ISSUER_DOWNTIME` is a `PAYMENT_BLOCKED` that overlaps an active downtime window"), *is* an issuer-downtime case. The detector was correct; the generator's label was the bug.
**Fix:** `PAYMENT_BLOCKED` and clean checkouts now pick their payment method from the set that excludes the downtime window's method, so the two scenarios can never accidentally collide.
**Learning:** when a test fails, check which side is actually wrong before "fixing" the code that produced the surprising answer — the detector's own unit tests (written first, independent of the generator) already proved its downtime-overlap logic was correct in isolation, which is what made it obvious the generator was the thing to fix, not the detector.

### Decision — a CHECK constraint as a second line of defense, not a replacement for the tested one
`classifyCheckout` is already proven to never return a leak with empty evidence, and `detect-for-merchant.test.ts` proves it again through the full write path. A `CHECK (cardinality(evidenceEventIds) > 0)` constraint on the `Leak` table on top of that isn't redundant — it protects against a *different* future bug (some other write path to the same table that doesn't go through this code). Prisma 7 can't express CHECK constraints in `schema.prisma`, so it lives in `prisma/manual-constraints.sql` and has to be applied by hand once per fresh database — documented in `AGENTS.md` so it isn't just tribal knowledge.

### Decision — the ledger is one global chain, locked with a Postgres advisory lock
**What:** the hash chain isn't per-merchant — every merchant's entries interleave in one linear sequence, and screen 3's "filter by merchant" is a display concern, not a chain-structure one.
**Why it needs a lock at all:** two concurrent appends both reading "the last entry" under Postgres's default isolation can both build on the same `prevHash`, forking the chain — a `SELECT ... FOR UPDATE` on the last row doesn't help either, because there's nothing to lock yet before the very first entry exists.
**Fix:** `pg_advisory_xact_lock` on a fixed key, held for the transaction's duration — serializes every append, including the genesis case. Proven with a real test: 10 concurrent `appendLedgerEntry` calls, then `verifyLedgerChain()` confirms one straight, unbroken line, not a fork.

### Bug — a tampered-chain response that would have crashed on the exact request that needed it most
**What broke:** `GET /ledger/verify` on a genuinely broken chain threw `TypeError: Do not know how to serialize a BigInt` instead of returning the 409 it was supposed to.
**Why:** `brokenAtSeq` is a Postgres `bigserial`, which Prisma maps to a JS `bigint` — and `JSON.stringify` (which Hono's `c.json()` uses) throws on a bare `bigint` rather than silently stringifying it.
**Fix:** convert `brokenAtSeq` to a string before it crosses the JSON boundary, same as every other bigint field already leaving this API.
**Learning:** confirmed this was a real bug, not defensive coding for something that couldn't happen — reverted the fix, watched the exact predicted crash happen, then restored it. The failure mode is exactly the demo-day nightmare: the one code path that only runs when something's actually wrong (a tampered chain) is also the one path least likely to get exercised by casual manual testing.

### Learning — proving "fails closed" took a deliberate choice of API, not just a try/catch
**What:** Shield's content check originally used `/pattern/.test(text)`, which coerces its argument to a string — so a `null` message would silently become the string `"null"`, match nothing, and pass every check instead of throwing. That would have made the "fails closed" test pass for the wrong reason (nothing ever actually failed).
**Fix:** switched to `text.match(pattern)`, which throws a real `TypeError` on `null`/`undefined` — so the fail-closed wrapper's `catch` block is genuinely exercised, not just present in the code.
**Learning:** "fails closed" is a claim about what happens when something throws — proving it means finding an input that *actually* throws, not just wrapping code in try/catch and trusting it. `.test()` vs `.match()` was the difference between a real proof and a test that would pass even if the catch block were deleted.

### Decision — the generator covers four of six leak classes, on purpose
`PAYMENT_BLOCKED`, `ISSUER_DOWNTIME`, `SILENT_ABANDON`, and `PRE_CHECKOUT_DROP` are all expressible with today's schema and are built and tested. `METHOD_CONCENTRATION` needs a 14-day baseline (one merchant-day of data can't establish a baseline to deviate from) and `POST_PURCHASE_LEAK` needs a refund/return model that doesn't exist yet — building either now would mean guessing at a shape before the detector that consumes it exists. Deferred deliberately, not forgotten.

### Naming — renamed twice before settling
The project went through two names before landing on **Seam**, which is also the central metaphor: two systems (storefront, payment gateway) that don't share a customer identity have a seam between them, and that seam is exactly where revenue goes missing unaccounted for. Renaming a running codebase is mechanical but easy to do sloppily — a global find-and-replace on macOS's `sed` missed one lowercase instance because BSD `sed`'s word-boundary matching isn't identical to GNU `sed`'s. Caught by grepping for the old name again after the rename, not by trusting the first pass.
