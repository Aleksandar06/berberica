# =============================================================================
# Production Dockerfile for @scheduling/web (Next.js 15, App Router).
#
# Multi-stage so the runtime image only contains the Next.js standalone server
# bundle. The image is built from the REPO ROOT, not from `apps/web`:
#     docker build -f apps/web/Dockerfile -t berberica-web .
# Railway does this automatically when given `dockerfilePath` + the repo as
# build context (see apps/web/railway.json).
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
RUN pnpm install --frozen-lockfile

# -----------------------------------------------------------------------------
# Stage 3 — build: compile schemas + Next.js standalone bundle
# -----------------------------------------------------------------------------
FROM deps AS build
COPY packages packages
COPY apps/web apps/web

# Next.js inlines NEXT_PUBLIC_* vars into the client bundle at build time.
# Railway only injects service variables at runtime, so we accept them as
# build args and re-export as ENV before `next build`.
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

# Build the shared schemas package first (web imports compiled JS from it).
RUN pnpm --filter @scheduling/schemas build || true
# `next build` with `output: 'standalone'` produces .next/standalone with a
# minimal server.js + only the node_modules it actually traces.
RUN pnpm --filter @scheduling/web build

# -----------------------------------------------------------------------------
# Stage 4 — runtime: smallest image with just the standalone server
# -----------------------------------------------------------------------------
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

# Non-root user for the runtime container.
RUN addgroup -S app && adduser -S app -G app

# The standalone output places a self-contained server at
# apps/web/.next/standalone/apps/web/server.js (monorepo layout is preserved).
COPY --from=build --chown=app:app /repo/apps/web/.next/standalone ./
# Static assets aren't bundled into standalone — they sit alongside.
COPY --from=build --chown=app:app /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=app:app /repo/apps/web/public ./apps/web/public

USER app
# Railway injects PORT; Next.js standalone respects it via process.env.PORT.
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
EXPOSE 3000

CMD ["node", "apps/web/server.js"]
