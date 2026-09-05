# Built with the repo root as build context (Render: "Root Directory" blank,
# "Dockerfile Path" apps/api/Dockerfile) — pnpm workspaces need the root
# lockfile and workspace manifest present to install correctly, not just
# this one package's package.json. See DEPLOYMENT.md.

FROM node:22-slim AS build
RUN corepack enable
WORKDIR /repo

# Manifests first, for Docker layer caching — installing doesn't re-run on
# every source change, only when a package.json or the lockfile changes.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile

COPY apps/api apps/api
RUN pnpm --filter @seam/api exec prisma generate
RUN pnpm --filter @seam/api build

FROM node:22-slim AS runtime
WORKDIR /repo

COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /repo/apps/api/dist ./apps/api/dist
COPY --from=build /repo/apps/api/prisma ./apps/api/prisma
COPY --from=build /repo/apps/api/package.json ./apps/api/package.json

WORKDIR /repo/apps/api
ENV NODE_ENV=production
# Render injects its own PORT at runtime — index.ts already reads
# process.env.PORT with an 8080 fallback, so nothing else to configure here.
CMD ["node", "dist/src/index.js"]
