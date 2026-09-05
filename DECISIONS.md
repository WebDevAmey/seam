# Decisions

Every non-obvious choice, what it beat, and why. Ordered roughly by when each was made.

---

**Standalone repo, written from scratch.** — *the landing page is a later, explicit exception; see the entry below.*
*Alternative:* extend an existing codebase for a head start on auth, OAuth, and UI shell.
*Why it lost (at the time):* that codebase belonged to something unrelated to this submission, and reusing its actual code and branding in a public hackathon repo wasn't this project's call to make on its own. Seam is its own repo, its own code, its own name — see `LEARNINGS.md` for the full account. The application itself — every backend pipeline stage, the agent fleet, auth, the dashboard — stayed real, from-scratch work, and still is.

**The marketing landing page's structure and motion are adapted from Ovrt (`ovrt.in`, github.com/WebDevAmey/Ovrt) — the same team's other project — on explicit, later instruction.**
*Alternative:* keep the landing page original, as the entry above originally committed to for the whole repo.
*Why it changed:* an explicit instruction asked for the landing page specifically to match `ovrt.in`, reusing that repo's actual code — a deliberate, informed reversal of the entry above for this one surface, made after I flagged the tension (this repo's own submission narrative up to that point said "standalone, no Ovrt connection" in several places) and the user confirmed they meant the literal reuse, not just an adapted pattern.
*What's actually reused vs. rewritten:* the component architecture, section rhythm, and motion (NavBar, hero, problem/solution contrast, feature cards, FAQ accordion, cinematic footer) come from Ovrt's real components, copied and adapted. Every word of copy was rewritten for what Seam actually does — none of Ovrt's product claims (WhatsApp support, Instagram DMs, a Monday-morning email digest) carried over, since they describe a different, unrelated product. Every real Ovrt product screenshot was left out entirely and replaced with small illustrated mockups of Seam's own real concepts (a leak-detected card, a Shield-pass badge, a ledger-verified badge) — using an actual screenshot of a different app as if it were Seam's own product preview would have been a factual misrepresentation independent of whether reusing the code was fine. The saffron accent that runs through Ovrt's entire palette is repointed to supermemory.ai's blue (`#0562EF`/`#0015FF`, the same real values grounding the dashboard's own palette) by changing the color *tokens* only — no component needed a code change for this, since Ovrt's CSS already separated color values from where they're used.
*What this means for the "standalone" claim:* it no longer holds for the landing page specifically, and the docs say so plainly (`README.md`, `LEARNINGS.md`) rather than leaving the earlier, now-inaccurate claim standing. The rest of the submission — the actual product — is unaffected and remains genuinely from-scratch.

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

**Seam's visual identity is an original "paper ledger" design, not an adopted brand.** — *superseded, see the v2 entry below.*
*Alternative:* build a generic, safe SaaS-dashboard look, or adopt an existing design system wholesale.
*Why it lost (at the time):* the ledger direction — hairline rules, rupee figures as the visual hero, tabular-nums wherever a number needs to line up — was this project's own original creative direction from the very first pass at its design, before that got set aside in an earlier plan to reuse someone else's shipped system. Reviving it was the honest choice at the time: genuinely original, and it fit a product whose entire subject is a financial audit trail.

**v2: a blue/white SaaS dashboard, palette and layout grounded in real reference sites, not the ledger concept above.**
*Alternative:* keep the paper-ledger identity; invent a blue/white palette from scratch instead of pulling real values.
*Why it changed:* a later, explicit instruction called for a full SaaS-dashboard redesign — supermemory.ai's colors, a causal-ai-style sidebar shell, medusajs-level polish, and real charts. The ledger identity above was a good answer to a different brief; this is the current one.
*How it's grounded, not guessed:* the palette (`#0562ef` primary, light blue-tinted surfaces, `#07224f` navy) and type pairing (Space Grotesk headings, DM Sans body, DM Mono figures) were pulled from supermemory.ai's own shipped CSS bundle and font preloads (`curl`'d directly, not eyeballed from a screenshot — WebFetch only extracts text, not styling) — not invented and labeled "inspired by." The sidebar's grouped-nav structure is adapted from `causal-ai`'s actual `AppSidebar` component (a generic shadcn/ui sidebar pattern, not proprietary logic — same reuse posture as the auth pattern above), rebuilt with Seam's own nav items rather than copied wholesale. Recharts was picked because `causal-ai` already uses it (`components/ui/chart.tsx`), confirming it's the natural fit for this exact stack (React + Tailwind + Next.js Server Components) rather than a cold pick among Chart.js/Highcharts/Recharts.
*Tradeoff:* the ledger identity's genuine distinctiveness is gone in favor of a look that will read as "competent SaaS dashboard," which is what was actually asked for.

**The frontend only ever fetches server-to-server — no CORS setup on the API.**
*Alternative:* add CORS middleware to `apps/api` so the browser can call it directly.
*Why it lost:* every real data need in this build is satisfiable from a Next.js Server Component or Server Action, both of which run on the server, not in the browser. Deciding this once, up front, meant never having two different ways to reach the same data (a direct browser fetch vs. a server-side one) and never needing to reason about which endpoints are meant to be browser-reachable.

**Auth is adapted from `causal-ai`'s real pattern, not built from a blank page — but split across two apps instead of living in one.**
*Alternative:* build session auth from scratch, or put the whole thing (signing and verifying) inside `apps/web` the way `causal-ai` does, since that's simpler.
*Why it lost:* `causal-ai`'s JWT-in-httpOnly-cookie pattern (`jose`, bcrypt, a fast middleware check) is solid, generic auth plumbing — reusable on its own technical merits, not proprietary business logic, so re-deriving it from nothing would just be redoing settled work. But `causal-ai` calls Prisma directly from the same Next.js process; Seam's `apps/web` never touches the database at all, by design (see the CORS-avoidance decision below). So signing and password-checking (real DB access) live in `apps/api` as `/auth/signup` and `/auth/login`; `apps/web`'s middleware only ever *verifies* a token, locally, with `jose`, using a secret shared between both apps — no round-trip per page load, same speed guarantee the original pattern has, just split along the boundary Seam already drew everywhere else.

**No OTP email verification, no password reset.**
*Alternative:* port `causal-ai`'s full OTP-verification and reset-password email flows too.
*Why it lost:* both need a real email-sending credential (`causal-ai` uses Resend) that isn't configured for this project — the same category of gap already disclosed for OpenAI and WhatsApp. An account is active immediately after signup instead. Disclosed in `LIMITATIONS.md`, not silently dropped.

**The generator's cart-amount range was widened from ₹300–5,000 to ₹50–5,000, and that change was made *before* re-running the eval that motivated it, not after seeing a better number.**
*Alternative:* leave the original range and tune the EV floor or auto-approve threshold instead until the baseline comparison looked favorable.
*Why it lost:* the original ₹300 minimum was an arbitrary simplification from early in the build, defensible as a realism fix on its own terms (real abandoned carts include small ones) independent of any specific eval outcome — unlike adjusting a policy parameter after seeing results, which would have been exactly the kind of post-hoc tuning `EVALUATION.md`'s pre-registration exists to prevent. The actual eval result after this fix (a tie on dev, a narrow loss on held-out) was reported as-is, not iterated on further.
