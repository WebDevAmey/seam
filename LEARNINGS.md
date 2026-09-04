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

### Decision — the join scorer is a pure function, deliberately decoupled from the database
**What:** `resolveJoin(payment, candidates)` takes plain objects in, returns a plain result out — no Prisma import, no I/O.
**Why:** this is the actual differentiator (most competing approaches never join the two data sources at all), so it needs to be provably correct on its own, independent of how candidates get fetched. All 9 tests run in milliseconds with no database.
**Learning:** floating-point addition needed a rounding guard (`0.40 + 0.35` can print as `0.7499999999999999` in JS) — rounding to 2 decimal places after summing avoids a boundary case (exactly 0.75) silently landing on the wrong side of the accept/ambiguous line.

### Naming — renamed twice before settling
The project went through two names before landing on **Seam**, which is also the central metaphor: two systems (storefront, payment gateway) that don't share a customer identity have a seam between them, and that seam is exactly where revenue goes missing unaccounted for. Renaming a running codebase is mechanical but easy to do sloppily — a global find-and-replace on macOS's `sed` missed one lowercase instance because BSD `sed`'s word-boundary matching isn't identical to GNU `sed`'s. Caught by grepping for the old name again after the rename, not by trusting the first pass.
