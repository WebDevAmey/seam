# Deployment

Real steps for the plan `PRD.md` §3.3 already settled on: `apps/api` on Render (Docker, free Web Service), Postgres on Neon (free), `apps/web` on Vercel (Hobby), kept warm by the GitHub Actions cron already sitting in `.github/workflows/keep-warm.yml`. Nothing here has been run yet; this is the runbook for when it is.

## 1. Database: Neon

1. Create a free Neon project. No card required.
2. Copy its connection string. That's `DATABASE_URL`.
3. From `apps/api` locally, pointed at that URL:
   ```bash
   DATABASE_URL="<neon connection string>" pnpm db:push
   psql "<neon connection string>" -f prisma/manual-constraints.sql
   ```
   `db:push` creates the schema and regenerates the Prisma client in one step (chained on purpose, see `LEARNINGS.md`). The `manual-constraints.sql` run is not optional: it adds the one constraint Prisma 7 can't express natively (`Leak.evidenceEventIds` can never be empty), and it has to run once against every fresh database, including Neon's.

## 2. Backend: Render

1. New Web Service, connect this GitHub repo.
2. Environment: **Docker**. Root Directory: blank (leave it at the repo root, not `apps/api`). Dockerfile Path: `apps/api/Dockerfile`. The Dockerfile's own top comment explains why root has to stay blank: pnpm workspaces need the root lockfile and `pnpm-workspace.yaml` present to install correctly, not just `apps/api`'s own `package.json`.
3. Region: Singapore, if available, it's the closest Render region to India. Confirm the current region list at deploy time, Render's offerings change.
4. Environment variables, all of them under Render's dashboard, not committed anywhere:
   - `DATABASE_URL` (Neon's connection string from step 1)
   - `DATASOURCE_ENC_KEY` (a real random string, this encrypts stored credentials at rest)
   - `JWT_SECRET` (a real random string, signs session tokens)
   - `SWEEP_SECRET` (a real random string, you'll reuse this in step 4)
   - `GROQ_API_KEY` (optional, without it Diagnosis stays rules-only, no live LLM escalation)
   - `OPENROUTER_API_KEY` (optional, without it `/recovery/chat` 503s with a clear message instead of failing silently)
   - `SHOPIFY_CLIENT_ID` / `SHOPIFY_CLIENT_SECRET` / `SHOPIFY_REDIRECT_URI` (only needed once a merchant actually connects a real Shopify store)
   - Render sets `PORT` itself; `src/index.ts` already reads `process.env.PORT` with a fallback, nothing to configure there.
5. Deploy. You'll get a URL like `https://seam-api-xxxx.onrender.com`. That's `SEAM_API_URL` for the next two steps.

## 3. Frontend: Vercel

1. Import this repo into Vercel. Set the project's root directory to `apps/web` (it's a pnpm workspace, Vercel's Next.js preset handles the monorepo case once you point it at the right subdirectory).
2. Environment variable: `SEAM_API_URL` set to the Render URL from step 2. Every server-side fetch in `apps/web/lib/api.ts` reads this one variable, there's nothing else to configure.
3. Deploy. This is the URL you actually hand a judge.

## 4. Keep the backend warm

Render's free Web Service sleeps after 15 minutes with no traffic, and Neon's free compute idles independently on its own 5-minute timer. `.github/workflows/keep-warm.yml` already exists in this repo and pings the real `POST /internal/sweep` endpoint (not a dummy health check) every 10 minutes, under both those thresholds, so the judging window never hits a cold start unless GitHub's own scheduler slips.

It needs two repo secrets, set once, under this GitHub repo's Settings → Secrets and variables → Actions:
- `SEAM_API_URL`: the Render URL from step 2, no trailing slash
- `SWEEP_SECRET`: the exact same value you set on Render in step 2

Until both secrets exist, the workflow runs and exits cleanly without pinging anything, it won't fail your Actions tab while you're still mid-setup.

## 5. Get real data onto the deployed instance

The deployed database starts empty. Either:
- Sign up fresh through the deployed frontend and let the app run with genuinely no data (an honest empty-state demo), or
- Run the real seed script against Neon: `DATABASE_URL="<neon connection string>" pnpm exec tsx --env-file=.env apps/api/scripts/seed-demo.ts` from `apps/api` (temporarily put the Neon URL in a local `.env` or export it inline). This runs the actual pipeline (detect, diagnose, decide, Shield, ledger) against Neon, the same as it does locally, it does not fake anything for being remote.

## 6. Verify, don't assume

Before calling this done: hit the Render URL's `/health` directly, log into the Vercel URL with real credentials, and click through at least the agent fleet, the leak map, and the ledger's verify button. A clean deploy log is not the same as a working app, the same lesson this whole build kept relearning locally applies here too.

## Known, disclosed risk

The first request after any idle gap the cron misses costs 30 to 60 seconds while Render's container cold-starts. That's a real, named trade-off of the free tier, not a bug, mitigated but not eliminated by the cron above.
