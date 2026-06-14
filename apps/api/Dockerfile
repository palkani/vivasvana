# syntax=docker/dockerfile:1.6
# =============================================================================
# Vivasvana API — Railway / generic Docker build
#
# Multi-stage so the final image ships only the production runtime artefacts
# (dist + production node_modules + the schema for Prisma). The intermediate
# `build` stage has the full pnpm workspace and devDependencies but is
# discarded after the COPY --from below.
#
# Build context expectations: the entire monorepo root (so pnpm-workspace
# can resolve @vivasvana/db and @vivasvana/config). railway.toml points
# Railway at the repo root; the `dockerfilePath` field tells it to use
# this file specifically.
# =============================================================================

# ---- Stage 1: deps ----------------------------------------------------------
# Cache-friendly: we copy only the manifests and lockfile first so docker
# can skip the install layer when source code changes but deps don't.
FROM node:20.11.0-bookworm-slim AS deps
WORKDIR /repo

# Install pnpm via corepack (ships with Node 20) — pinned to the version
# package.json's `packageManager` field declares.
ENV COREPACK_DEFAULT_TO_LATEST=0
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

# Copy manifests (lockfile + every workspace package.json) only. This layer
# only invalidates when one of those changes, so source-only edits stay
# fast in CI.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/config/package.json ./packages/config/
COPY packages/db/package.json ./packages/db/

# `--ignore-scripts` skips any postinstall in the workspace; we don't have
# Prisma postinstall hooks but the flag protects against accidentally
# running `prisma generate` against a missing schema here.
RUN pnpm install --frozen-lockfile --ignore-scripts

# ---- Stage 2: build ---------------------------------------------------------
FROM node:20.11.0-bookworm-slim AS build
WORKDIR /repo

RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

# Bring node_modules from the deps stage, then layer in the source. Source
# changes invalidate only this layer onward.
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /repo/packages/db/node_modules ./packages/db/node_modules
COPY --from=deps /repo/packages/config/node_modules ./packages/config/node_modules

# Copy the source we actually need to build the API. We deliberately do
# NOT copy apps/web — that's Vercel's job — to keep the image lean and
# the build deterministic.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY apps/api ./apps/api
COPY packages/db ./packages/db
COPY packages/config ./packages/config

# Build the db package first — its `build` script runs `prisma generate`
# AND `tsc` so packages/db/dist/index.js exists at runtime. Plain Node can't
# import .ts files, so @vivasvana/db must be compiled before the API tries
# to require it. Then compile the API itself.
RUN pnpm --filter @vivasvana/db build
RUN pnpm --filter @vivasvana/api build

# Trim node_modules to production-only so the runtime image stays small.
# `--prod` removes devDependencies (tsx, eslint, vitest, etc.) which we
# don't need at runtime.
RUN pnpm install --frozen-lockfile --prod --ignore-scripts

# ---- Stage 3: runtime -------------------------------------------------------
FROM node:20.11.0-bookworm-slim AS runtime
WORKDIR /app

# OpenSSL is required by Prisma's binary engine on Debian-slim. The bookworm
# image already has libssl3 but the prisma engine looks for libssl1.1
# fallback; without it Prisma boots with a noisy "couldn't find OpenSSL"
# warning. Installing once here makes that go away.
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Non-root user for runtime — small defence in depth so a container escape
# doesn't land an attacker as root.
RUN groupadd --system --gid 1001 app \
    && useradd  --system --uid 1001 --gid app --no-create-home app

# Copy ONLY the production artefacts:
#   - root + workspace package.json files for resolution
#   - prod node_modules (no devDeps)
#   - the compiled API output
#   - the Prisma schema (engine reads it at runtime)
COPY --from=build --chown=app:app /repo/package.json /repo/pnpm-workspace.yaml ./
COPY --from=build --chown=app:app /repo/node_modules ./node_modules
COPY --from=build --chown=app:app /repo/apps/api/package.json ./apps/api/package.json
COPY --from=build --chown=app:app /repo/apps/api/node_modules ./apps/api/node_modules
COPY --from=build --chown=app:app /repo/apps/api/dist ./apps/api/dist
COPY --from=build --chown=app:app /repo/packages/db/package.json ./packages/db/package.json
COPY --from=build --chown=app:app /repo/packages/db/node_modules ./packages/db/node_modules
COPY --from=build --chown=app:app /repo/packages/db/prisma ./packages/db/prisma
# dist holds the compiled .js — package.json's `main` and `exports` now
# point here, so Node resolves @vivasvana/db to compiled JavaScript instead
# of the original .ts source (which production Node can't execute).
COPY --from=build --chown=app:app /repo/packages/db/dist ./packages/db/dist
COPY --from=build --chown=app:app /repo/packages/config/package.json ./packages/config/package.json

USER app

# Railway sets PORT in the environment; the Fastify server reads it via
# API_PORT, defaulting to 4000. The EXPOSE is informational only.
ENV NODE_ENV=production
EXPOSE 4000

# Direct node invocation — `pnpm` would work too but adds a process layer
# and pnpm itself isn't strictly needed at runtime.
CMD ["node", "apps/api/dist/server.js"]
