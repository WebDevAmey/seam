# Limitations

Disclosed, quantified where possible, not explained away. Each of these is a real gap in the current build, not a hedge.

## 1. Two leak classes have no detector

`METHOD_CONCENTRATION` (needs a 14-day baseline to compute a deviation against — one merchant-day of synthetic data can't establish one) and `POST_PURCHASE_LEAK` (needs a refund/return data model that doesn't exist in this schema yet) are named in the taxonomy but not implemented. `classifyCheckout` only classifies the other four. Quantified: 2 of 6 leak classes, 0% coverage.

## 2. "Net rupees recovered" is predicted EV, not realised recovery

There's no outcome worker in this build — nothing listens for a `payment.captured` webhook arriving within 72h of a dispatched action and attributes it back. So every recovery number in `EVALUATION.md` is the policy's own expected-value arithmetic, using hand-set (not learned, not validated against real outcomes) priors in `src/policy/decide.ts`. The eval proves the arithmetic is internally consistent and the gating logic works; it does not prove real rupees moved, because none did — this is entirely test-mode/synthetic data.

## 3. On the eval data run so far, Seam ties or trails `blast_everything` on auto-dispatched net value

Full explanation, not just the number, is in `EVALUATION.md`. Short version: across both the dev and held-out seeded sets, every gap between Seam's net and the naive "message everyone" baseline is fully explained by Shield correctly holding specific actions back — one for human approval, one below the profitability floor — that the naive strategy would have fired blindly. Seam's *total addressable value* (dispatched + pending approval) is within ~0.3% of blast_everything's on the held-out run. The eval, as currently built, generates independent single-day leaks with no repeat customers, so it never gives Shield's contact-cap the chance to matter — that's a real gap in eval *scenario coverage*, disclosed rather than hidden, and it means the "beats blast_everything on net" claim is not yet cleanly proven at the portfolio level, even though the underlying floor and cap logic are individually tested and correct in isolation.

## 4. The LLM diagnosis path has never been exercised against a live model

There's no `OPENAI_API_KEY` or Langfuse account for this project. `classifyWithOpenAI` is fully written and typechecks against the real SDK, the LangGraph subgraph around it (retry, fail-safe, crash-resumability) is fully tested with a mocked classifier, and the 7 prompt-injection fixtures prove the *safety path* — but nothing here proves a real model actually produces correct diagnoses or actually recognises an injection attempt. That would need real credentials and is a model-quality question this build can't answer.

## 5. No real WhatsApp (or SMS) adapter

Both channels are simulated behind a `ChannelAdapter` interface shaped so a real implementation is a one-file swap. Neither sends a real message anywhere. This was originally planned around reusing a real Business Cloud API adapter from elsewhere; that source is no longer available to this standalone build (see `LEARNINGS.md`).

## 6. No login/session auth

Every screen renders one hardcoded `SEAM_DEMO_MERCHANT_ID` from the environment. There is no multi-tenant boundary enforced at the HTTP layer beyond the `merchantId` path/query params the caller supplies — anyone who can reach the API can read or write against any merchant ID. Acceptable for a local demo; not acceptable for anything a stranger could reach on the open internet, which is why the deploy plan (Render, still pending) needs this addressed or the API kept off a public URL before that happens.

## 7. Diagnosis accuracy against ground truth isn't measured

The generator plants a leak *class* but not an independent "true underlying decline reason" label separate from what it writes onto the `PaymentAttempt` row itself, so there's no independent ground truth to score `classifyDiagnosis` against without the eval trivially grading its own homework. Combined with §4 above (no live LLM), this metric from the original evaluation plan isn't reported.

## 8. One shared Postgres connection pool

`apps/api`'s `prisma.ts` is a single `PrismaClient` instance backing every route — ingest, resolve, detect, execute, the read APIs the frontend calls. A slow or wide query anywhere can compete for connections with a latency-sensitive webhook ack. Not yet split into dedicated pools per subsystem; disclosed as a known architectural simplification, not discovered live.

## 9. Deployment hasn't happened yet

Render, Neon, and the GitHub Actions keep-warm cron are all planned (`PRD.md` §3.3) but not yet set up — everything in this build has been run and tested locally. The cold-start risk that plan discloses is real once deployed; right now it's simply not deployed.
