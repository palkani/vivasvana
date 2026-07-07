# Vivasvana

Production-grade ecommerce platform for **Vivasvana** — an Indian millet nutrition brand. Replaces a Shopify store with a custom Node.js stack tailored for the Indian market (Razorpay, Shiprocket, GST, COD).

## Tech stack

- **Monorepo:** pnpm workspaces + Turborepo
- **Storefront + admin:** Next.js 15 (App Router) on Vercel
- **API:** Fastify (TypeScript) on Railway
- **Database:** Postgres via Supabase (Prisma ORM)
- **Auth + Storage:** Supabase Auth, Supabase Storage
- **Cache / sessions:** Redis (Upstash in prod, local docker in dev)
- **Payments:** Razorpay (UPI/cards/netbanking) + COD
- **Shipping:** Shiprocket
- **Email:** Resend + React Email
- **Analytics:** Plausible + Vercel Analytics + GTM

## Repository layout

```
vivasvana/
├── apps/
│   ├── web/      Next.js 15 storefront + admin
│   └── api/      Fastify backend (REST API)
├── packages/
│   ├── db/       Prisma schema + client (shared)
│   ├── types/    Shared TypeScript types + zod schemas
│   └── config/   Shared tsconfig, ESLint, Tailwind preset
├── supabase/     Supabase CLI local stack config + migrations
└── docker-compose.yml   Local Redis (Supabase CLI runs Postgres)
```

## Prerequisites

- **Node.js** 20.11+ (use `nvm use` to match `.nvmrc`)
- **pnpm** 9+ (`npm i -g pnpm@9`)
- **Docker Desktop** (for local Redis + Supabase stack)
- **Supabase CLI** — install: `brew install supabase/tap/supabase`

## Getting started

```bash
# 1. Install deps
pnpm install

# 2. Copy env vars
cp .env.example .env

# 3. Start local infra
docker compose up -d          # Redis
supabase start                # Postgres + Auth + Storage + Studio
                              # → prints anon/service_role keys; copy into .env

# 4. Run migrations + seed
pnpm db:migrate
pnpm db:seed

# 5. Start dev servers
pnpm dev                      # web on :3000, api on :4000
```

Open <http://localhost:3000> for the storefront, <http://localhost:4000/docs> for the API (Swagger).

## Common scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Run all apps in dev mode (turbo) |
| `pnpm build` | Production build for all apps |
| `pnpm lint` | ESLint across the monorepo |
| `pnpm typecheck` | TypeScript across the monorepo |
| `pnpm test` | Run all test suites |
| `pnpm db:migrate` | Apply pending Prisma migrations |
| `pnpm db:seed` | Seed dev data (3 products + admin user) |
| `pnpm db:studio` | Open Prisma Studio |
| `pnpm supabase:start` | Start local Supabase stack |
| `pnpm supabase:stop` | Stop local Supabase stack |
| `pnpm format` | Prettier write |

## Phases

| Phase | Scope | Status |
|---|---|---|
| 1 | Foundation: workspace, schema, auth, product CRUD, storefront PLP/PDP, cart | in progress |
| 2 | Checkout, Razorpay, COD, orders, emails, customer account | pending |
| 3 | Shiprocket, fulfillment, inventory, admin dashboard, discounts | pending |
| 4 | Blog, static pages, SEO, newsletter, FAQ, testimonials, reviews | pending |
| 5 | Performance, security audit, Shopify migration, 301 redirects, launch | pending |

## Branching

- `main` — production
- `development` — integration branch (current working branch)
- `feature/*` — feature branches off `development`

## License

Proprietary — © Vivasvana.
