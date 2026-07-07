# Phase 1 — Foundation

Goal of Phase 1: a working monorepo where a guest visitor can browse products and add them to a cart, and an admin user can create/edit products. No checkout, no payments, no email yet — those land in Phase 2.

## What's in this phase

| Area | Done |
|---|---|
| pnpm + Turborepo monorepo | ✓ |
| Prisma schema covering all 5 phases | ✓ |
| Supabase CLI local stack config | ✓ |
| Fastify API with JWT (Supabase HS256) auth, helmet, CORS, rate limit, Swagger | ✓ |
| `/api/products` (public list + detail) | ✓ |
| `/api/admin/products` (CRUD, soft delete) | ✓ |
| `/api/cart` for guest + logged-in users with cookie-keyed sessions | ✓ |
| Next.js 15 storefront: home, PLP, PDP | ✓ |
| Cart page with zustand store, optimistic mutations | ✓ |
| Admin shell + product CRUD UI | ✓ |
| Integration tests for auth + products + cart | ✓ |
| GitHub Actions CI: lint + typecheck + test + build | ✓ |

## Not in Phase 1 (deferred)

- Checkout flow (Phase 2)
- Razorpay integration (Phase 2)
- COD with OTP verification (Phase 2)
- Order emails via Resend (Phase 2)
- Shipping via Shiprocket (Phase 3)
- Inventory adjustments UI (Phase 3)
- Blog, FAQ, testimonials in admin (Phase 4)
- Reviews submission flow (Phase 4)
- Shopify data migration + 301 redirects (Phase 5)

## Local development — start to finish

### 1. Prereqs

- Node 20.11+ (`nvm use`)
- pnpm 9 (`corepack enable && corepack prepare pnpm@9 --activate`)
- Docker Desktop running
- Supabase CLI (`brew install supabase/tap/supabase`)

### 2. Install

```bash
pnpm install
cp .env.example .env
```

### 3. Boot local infra

```bash
# Postgres + Auth + Storage + Studio (takes ~2 min first run)
supabase start

# Redis sidecar
docker compose up -d
```

`supabase start` prints the **anon key**, **service_role key**, and **JWT secret**. Copy them into `.env` — these are the values for `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, and also `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

### 4. Apply schema + seed

```bash
pnpm db:migrate     # runs prisma migrate dev on the Supabase Postgres
pnpm db:seed        # 3 products, testimonials, blog post, WELCOME10 discount
```

### 5. Create the admin Supabase auth user

The seed creates a `User` row with `id = 00000000-0000-0000-0000-000000000001` and `role = ADMIN`. You need a Supabase auth user with the **same UUID** to log in.

1. Open Supabase Studio at <http://127.0.0.1:54323>.
2. Auth → Users → **Add user** → Create new user.
3. Email: `admin@vivasvana.local`, password: any 8+ chars.
4. After creating, copy the generated user's UUID.
5. In Studio, open SQL editor and run:
   ```sql
   UPDATE auth.users SET id = '00000000-0000-0000-0000-000000000001' WHERE email = 'admin@vivasvana.local';
   ```
   (Or simpler: delete and re-create the user via SQL with a specified `id`. We'll wire a CLI helper in Phase 2.)

### 6. Run the apps

```bash
pnpm dev
```

- Storefront: <http://localhost:3000>
- Admin: <http://localhost:3000/admin> (redirects to /admin/login)
- API: <http://localhost:4000>
- API docs: <http://localhost:4000/docs>
- API health: <http://localhost:4000/health>

### 7. Run the tests

```bash
pnpm test                       # all packages
pnpm --filter @vivasvana/api test
```

## Sanity check the end-to-end flow

1. Open `/` — three product cards render. Click one.
2. On the PDP, click **Add to cart**. Header cart icon should highlight (Phase 1.5 polish — for now, navigate to `/cart`).
3. On `/cart`, change quantity with +/−. Subtotal and shipping update.
4. Open `/admin/login`, sign in with admin@vivasvana.local.
5. Go to `/admin/products` → see 3 seeded SKUs.
6. Click one → edit title → save → see change on the public PDP within 60s (revalidate window).

## Known limitations carried into Phase 2

- The **admin User UUID dance** (manual SQL in Studio) is annoying. Phase 2 commit 1 ships a `pnpm admin:create` CLI that creates a Supabase auth user with the right UUID and a mirror User row in one shot.
- Cart **session merge on login** is implemented at the API but not yet wired in the web app — guests upgrading to logged-in users currently lose their cart. Phase 2 wires `useEffect` post-login to POST `/api/cart/merge`.
- **Stock decrement at checkout** is intentionally not in Phase 1. Add-to-cart only validates availability; actual decrement happens when an order is paid in Phase 2.
- **Image upload** in the admin product form is not yet built. Images are seeded via placeholder URLs. Phase 2 adds Supabase Storage upload via a signed URL flow.

## API endpoints (Phase 1)

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/health` | — | Liveness |
| GET | `/ready` | — | DB + Redis readiness |
| GET | `/api/products` | — | Public list, filters & sort |
| GET | `/api/products/:slug` | — | Public detail |
| GET | `/api/cart` | optional | Guest cart by cookie or user cart by JWT |
| POST | `/api/cart/items` | optional | Add item; 409 on insufficient stock |
| PUT | `/api/cart/items/:itemId` | optional | Set quantity (0 = remove) |
| DELETE | `/api/cart/items/:itemId` | optional | Remove |
| POST | `/api/cart/clear` | optional | Empty cart |
| POST | `/api/cart/merge` | **required** | Merge guest cart into user cart |
| GET | `/api/admin/products` | **admin** | All statuses |
| GET | `/api/admin/products/:id` | **admin** | By UUID |
| POST | `/api/admin/products` | **admin** | Create |
| PUT | `/api/admin/products/:id` | **admin** | Update |
| DELETE | `/api/admin/products/:id` | **admin** | Soft delete (archive) |
