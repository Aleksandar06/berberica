# Scheduling SaaS

Multi-tenant scheduling and appointment booking platform.

> This is **Step 1** of a multi-step build: the monorepo foundation, local
> infrastructure, and a booting API + Web app. Database schema, auth, tenant
> resolution, availability, and booking are added in later steps.

## Stack

| Layer    | Tech                                                          |
| -------- | ------------------------------------------------------------- |
| Web      | Next.js 15 (App Router), TypeScript, Tailwind                 |
| API      | NestJS 11 on **Fastify**, TypeScript (modular monolith)       |
| DB       | PostgreSQL 16 (Supabase in prod, Docker locally)              |
| Cache/Q  | Redis 7 (Upstash in prod, Docker locally) + BullMQ            |
| Storage  | Supabase Storage in prod, MinIO locally                       |
| Monorepo | pnpm workspaces + Turborepo                                   |

## Prerequisites

- [Node.js 20 LTS](https://nodejs.org/) (see [.nvmrc](.nvmrc))
- [pnpm 9+](https://pnpm.io/installation)
- [Docker](https://www.docker.com/) (for local Postgres, Redis, MinIO)

## Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Copy env template
cp .env.example .env        # or: copy .env.example .env  (Windows)

# 3. Start local infrastructure
docker compose up -d

# 4. Run both apps in dev mode
pnpm dev
```

## Verify

| Check               | URL / Command                              | Expected                          |
| ------------------- | ------------------------------------------ | --------------------------------- |
| API health          | `curl http://localhost:4000/health`        | `{"status":"ok","timestamp":...}` |
| Web placeholder     | <http://localhost:3000>                    | "Scheduling SaaS — Coming Soon"   |
| Postgres            | `docker compose ps postgres`               | container is `healthy`            |
| Redis               | `docker compose ps redis`                  | container is `healthy`            |
| MinIO console       | <http://localhost:9001>                    | login page                        |

## Layout

```
apps/
  api/                NestJS 11 (Fastify) — REST API
  web/                Next.js 15 (App Router) — public storefront + dashboards
packages/
  config/             Shared tsconfig + ESLint preset
  schemas/            Shared Zod schemas (Step 3)
  types/              Shared TypeScript types (later)
docker-compose.yml    Local Postgres 16, Redis 7, MinIO
turbo.json            Turborepo task pipeline
```

## Root scripts

| Command          | Description                            |
| ---------------- | -------------------------------------- |
| `pnpm dev`       | Run all apps in watch mode             |
| `pnpm build`     | Build all apps                         |
| `pnpm lint`      | Lint all packages                      |
| `pnpm typecheck` | Run `tsc --noEmit` across the monorepo |
| `pnpm format`    | Format the repo with Prettier          |

## Multi-tenancy preview (built later)

The platform serves many tenants from one shared domain with **path-based
routing**: `/:slug/...` identifies the tenant. Examples:

- `https://www.example.com/elite-barbers` — storefront for tenant `elite-barbers`
- `https://www.example.com/smile-dental/services` — a different tenant entirely

Reserved slugs (cannot be tenants): `admin`, `api`, `dashboard`, `login`,
`register`, `pricing`, `support`, `terms`, `privacy`, `settings`, `account`.

Tenant isolation is enforced **on the backend** in a later step: dashboards
resolve tenant from the authenticated session; public routes resolve from the
URL slug; `tenant_id` from a request body is never trusted; cross-tenant
lookups return 404.
