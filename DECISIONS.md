# Decisions

Every non-obvious choice, what it beat, and why. Ordered roughly by when each was made.

---

**Standalone repo, written from scratch.**
*Alternative:* extend an existing codebase for a head start on auth, OAuth, and UI shell.
*Why it lost:* that codebase belongs to something unrelated to this submission. Reusing its actual code and branding in a public hackathon repo isn't this project's call to make. Seam is its own repo, its own code, its own name — see `LEARNINGS.md` for the full account. The auth/shell/OAuth savings that reuse would have offered stayed as design guidance only; the actual hours in the build order reflect real, from-scratch work.

**TypeScript + Hono, not Python + FastAPI.**
*Alternative:* a separate Python service, keeping the trust boundary enforced by Pydantic.
*Why it lost:* the trust boundary doesn't need Pydantic specifically — Zod v4 plus the Vercel AI SDK's `generateObject` enforces the identical strict-schema contract at the same layer, in the same language as the rest of the stack. A second language and a second deploy target buys nothing a time-boxed build can afford.

**Postgres as the queue (`FOR UPDATE SKIP LOCKED`), not Redis or a message broker.**
*Alternative:* a dedicated queue service.
*Why it lost:* the database that holds the domain data can also enforce exclusive claims on it, with no second system to keep consistent with the first, no second thing to provision or monitor. Proven under real concurrency (`claim.test.ts`), not assumed correct because the pattern is well-known.

**Status-scoped partial unique index for idempotency, not a flat `UNIQUE`.**
*Alternative:* `@@unique([merchantId, checkoutId, actionClass])` directly in the Prisma schema.
*Why it lost:* a flat unique constraint would mean a single transient failure (a Razorpay timeout, a network blip) permanently blocks ever retrying that action — the row exists forever in a `FAILED` state and nothing can create a fresh one. Scoping the constraint to `state IN ('RESERVED', 'DISPATCHED')` (`prisma/manual-constraints.sql`) makes a `FAILED` row not count against it, so a genuine retry after a genuine failure is still possible, while an *active or already-sent* action still can't be duplicated.

**Razorpay connect is a pasted Key ID + Key Secret, not OAuth.**
*Alternative:* an OAuth redirect flow, matching how Shopify's own connect works.
*Why it lost:* Razorpay has no merchant-facing OAuth product — "Razorpay Connect" requires partner approval a time-boxed build won't have. The realistic pattern, and what real Razorpay integrations in test mode actually do, is the merchant pasting their keys directly. Verified live against Razorpay's own API before ever encrypting and storing them, so a typo or a revoked key is caught at connect time, not the first time a webhook needs it.

**One global hash-chained ledger, not a chain per merchant.**
*Alternative:* scope the chain to `merchantId`, so each merchant's audit trail is independently verifiable.
*Why it lost:* a single linear chain is simpler to reason about and verify, and the demo's "filter by merchant" need is a display concern, not a structural one — `GET /ledger?merchantId=...` filters rows for viewing without needing a different chain underneath. The cost is that verifying *any* merchant's history means recomputing the *entire* chain, which is a real, disclosed operational property, not a hidden one — `verifyLedgerChain()` always processes every entry from genesis.

**A Postgres advisory lock for ledger appends, not a row lock.**
*Alternative:* `SELECT ... FOR UPDATE` on the most recent entry before computing the next hash.
*Why it lost:* there's nothing to lock via `FOR UPDATE` before the very first entry exists — the empty-table case would race regardless. `pg_advisory_xact_lock` on a fixed key serializes every append unconditionally, genesis included. Proven with 10 real concurrent appends producing one unbroken chain, not a fork.

**One classifier for four leak classes, not four independent detector modules.**
*Alternative:* a separate pure function per leak class, mirroring a "many small detectors" pattern.
*Why it lost:* a checkout is provably in exactly one of `PAYMENT_BLOCKED` / `ISSUER_DOWNTIME` / `SILENT_ABANDON` / `PRE_CHECKOUT_DROP` at a time — they're mutually exclusive outcomes of one classification decision, not independent signals that could all fire simultaneously. Forcing that into four separately-invoked modules would mean either duplicating the mutual-exclusivity logic across them or introducing an ad hoc priority order between supposedly independent things. One function with clearly named internal rules is what the domain actually looks like.

**`METHOD_CONCENTRATION` and `POST_PURCHASE_LEAK` have no detector.**
*Alternative:* build simplified versions now, even without real baseline/refund data.
*Why it lost:* `METHOD_CONCENTRATION` needs a 14-day baseline to compute a deviation against — one merchant-day of synthetic data can't establish one, and guessing at what "enough history" looks like before there's a real detector consuming it is wasted, speculative work. `POST_PURCHASE_LEAK` needs a refund/return model that doesn't exist in the schema. Both deferred deliberately, logged in `LEARNINGS.md`, not silently dropped.

**The idempotency reservation lives in the executor, not inside `evaluateShield`.**
*Alternative:* fold the reservation into Shield itself, matching its position (check 6 of 7) in the original design sketch.
*Why it lost:* `evaluateShield` is a pure function on purpose — no database access, which is what makes its retry/fail-closed logic fast and simple to test exhaustively. The reservation is real, impure, database-touching work. It runs in the executor immediately after Shield passes and immediately before any expensive work (a real Razorpay API call) happens, which is the actual intent behind "reserve before spending anything" — not a literal requirement that the reservation live inside a stateless function.

**Simulated SMS and WhatsApp behind one `ChannelAdapter` interface — no real adapter for either.**
*Alternative:* a real WhatsApp Business Cloud API integration, assumed reusable early in planning.
*Why it lost:* that assumption depended on infrastructure this standalone build doesn't have access to (see `LEARNINGS.md`). Both channels are simulated behind an interface shaped so a real implementation is a one-file swap later, not a rearchitecture.

**Seam's visual identity is an original "paper ledger" design, not an adopted brand.**
*Alternative:* build a generic, safe SaaS-dashboard look, or adopt an existing design system wholesale.
*Why it lost:* the ledger direction — hairline rules, rupee figures as the visual hero, tabular-nums wherever a number needs to line up — was this project's own original creative direction from the very first pass at its design, before that got set aside in an earlier plan to reuse someone else's shipped system. Reviving it is the honest choice: genuinely original, and it fits a product whose entire subject is a financial audit trail better than a borrowed identity would.

**The frontend only ever fetches server-to-server — no CORS setup on the API.**
*Alternative:* add CORS middleware to `apps/api` so the browser can call it directly.
*Why it lost:* every real data need in this build is satisfiable from a Next.js Server Component or Server Action, both of which run on the server, not in the browser. Deciding this once, up front, meant never having two different ways to reach the same data (a direct browser fetch vs. a server-side one) and never needing to reason about which endpoints are meant to be browser-reachable.

**One hardcoded demo merchant, no login UI.**
*Alternative:* build real session-based auth.
*Why it lost:* real auth is real hours a time-boxed build doesn't need to spend to prove the actual claims this project is making. A single merchant's real, generated data is a stronger demo than a login screen guarding an empty one. Disclosed as a real limitation (`LIMITATIONS.md`, item 6) rather than presented as a finished multi-tenant boundary.

**The generator's cart-amount range was widened from ₹300–5,000 to ₹50–5,000, and that change was made *before* re-running the eval that motivated it, not after seeing a better number.**
*Alternative:* leave the original range and tune the EV floor or auto-approve threshold instead until the baseline comparison looked favorable.
*Why it lost:* the original ₹300 minimum was an arbitrary simplification from early in the build, defensible as a realism fix on its own terms (real abandoned carts include small ones) independent of any specific eval outcome — unlike adjusting a policy parameter after seeing results, which would have been exactly the kind of post-hoc tuning `EVALUATION.md`'s pre-registration exists to prevent. The actual eval result after this fix (a tie on dev, a narrow loss on held-out) was reported as-is, not iterated on further.
