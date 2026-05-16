# =============================================================================
# Production Dockerfile for @scheduling/api.
#
# Multi-stage so the runtime image only contains the compiled JS + node_modules
# the API actually needs at runtime. The workspace layout means we have to
# copy the whole monorepo into the build stages — pnpm hoists deps to the
# root `node_modules` and the API depends on the workspace package
# `@scheduling/schemas`.
#
# The image is built from the REPO ROOT, not from `apps/api`:
#     docker build -f apps/api/Dockerfile -t berberica-api .
# Railway / Render do this automatically when given `dockerfilePath` +
# the repo as build context.
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1 — base: pinned Node + pnpm via corepack
# -----------------------------------------------------------------------------
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /repo

# -----------------------------------------------------------------------------
# Stage 2 — deps: install all workspace deps (cached unless lockfile changes)
# -----------------------------------------------------------------------------
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY packages/config/package.json packages/config/
COPY packages/schemas/package.json packages/schemas/
COPY packages/types/package.json packages/types/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
# `--frozen-lockfile` enforces parity with what's in git.
# Compilers like @node-rs/argon2 install prebuilt binaries on alpine.
RUN pnpm install --frozen-lockfile

# -----------------------------------------------------------------------------
# Stage 3 — build: compile schemas + API, generate prisma client
# -----------------------------------------------------------------------------
FROM deps AS build
# Copy the rest of the monorepo source. Splitting from the deps step lets
# the deps layer stay cached across source-only changes.
COPY packages packages
COPY apps/api apps/api

# Build the shared schemas package first (API imports compiled JS from it).
RUN pnpm --filter @scheduling/schemas build || true
# Generate the Prisma client so `import { PrismaClient } from "@prisma/client"`
# in the compiled JS resolves at runtime.
RUN pnpm --filter @scheduling/api exec prisma generate
# Compile the API.
RUN pnpm --filter @scheduling/api build

# Prune dev dependencies so the runtime image is leaner. `deploy` copies a
# self-contained node_modules into /out — no symlinks, safe to ship.
RUN pnpm --filter @scheduling/api deploy --prod /out
# Regenerate the Prisma client INTO the pruned node_modules. `pnpm deploy`
# creates a fresh /out/node_modules and does not carry over generated files
# (.prisma/client) from the workspace node_modules, so we regenerate here.
RUN cd /out && node_modules/.bin/prisma generate --schema=/repo/apps/api/prisma/schema.prisma

# -----------------------------------------------------------------------------
# Stage 4 — runtime: smallest image with just what the API needs
# -----------------------------------------------------------------------------
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

# Non-root user for the runtime container.
RUN addgroup -S app && adduser -S app -G app

# Compiled JS + production node_modules from the deploy step.
COPY --from=build --chown=app:app /out/node_modules ./node_modules
COPY --from=build --chown=app:app /repo/apps/api/dist ./dist
# Prisma needs its schema + migration history at runtime to run
# `prisma migrate deploy` on boot.
COPY --from=build --chown=app:app /repo/apps/api/prisma ./prisma
COPY --from=build --chown=app:app /repo/apps/api/package.json ./package.json

USER app
# Railway / Render inject PORT; main.ts already respects it.
EXPOSE 4000

# Apply pending migrations on every boot, then start. Idempotent — `migrate
# deploy` is a no-op when the DB is already up-to-date.
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node dist/main.js"]
