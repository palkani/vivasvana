# Deploying to Vercel

The 404 you saw is almost always one of three things in a Turborepo monorepo:

1. **Vercel didn't know which app to build** — the repo has no top-level `app/` or `pages/` directory, so Vercel can't detect Next.js.
2. **Vercel built the workspace but couldn't find the Next.js output** — `outputDirectory` wasn't pointed at `apps/web/.next`.
3. **The build succeeded but every RSC fetch crashed** — `NEXT_PUBLIC_API_URL` still pointed at `http://localhost:4000`, so any page that calls the API returns an error → Vercel serves the 404 fallback.

The `vercel.json` at the repo root now tells Vercel exactly what to do. Follow the steps below.

## 1. Project setup in Vercel dashboard

**Root Directory:** leave at repository root (`./`).
`vercel.json` drives the build; you do NOT need to set Root Directory to `apps/web`.

If you already set the Root Directory to `apps/web` in the dashboard, **change it back to `./`** — otherwise the install command won't see the pnpm workspace and packages/db won't be installed.

Project Settings → General:
- **Framework Preset:** Other (let `vercel.json` decide). Vercel will still detect Next.js from the Build output.
- **Build Command:** leave empty (uses `vercel.json`).
- **Install Command:** leave empty (uses `vercel.json`).
- **Output Directory:** leave empty (uses `vercel.json`).
- **Node.js Version:** 20.x

## 2. Required environment variables

In Project Settings → Environment Variables, add:

| Variable | Where to get the value | Production scope |
|---|---|---|
| `DATABASE_URL` | Supabase cloud project → Settings → Database → "Connection string" (URI mode, port 6543 pooler) | Production + Preview |
| `DIRECT_URL` | Same but port 5432 direct (Prisma uses this for migrations) | Production + Preview |
| `SUPABASE_URL` | Supabase project → Settings → API → Project URL | Production + Preview |
| `SUPABASE_ANON_KEY` | Same → "anon public" key | Production + Preview |
| `SUPABASE_SERVICE_ROLE_KEY` | Same → "service_role" key (SERVER ONLY) | Production + Preview |
| `SUPABASE_JWT_SECRET` | Same → JWT secret | Production + Preview |
| `JWT_SECRET` | Same value as SUPABASE_JWT_SECRET works for now | Production + Preview |
| `NEXT_PUBLIC_SUPABASE_URL` | Same as SUPABASE_URL | Production + Preview |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same as SUPABASE_ANON_KEY | Production + Preview |
| `NEXT_PUBLIC_SITE_URL` | `https://your-vercel-url.vercel.app` | Production + Preview |

Server-side integrations the API route handlers use (all optional — each
degrades to a dev/stub mode when absent): `RESEND_API_KEY`,
`SHIPROCKET_EMAIL` / `SHIPROCKET_PASSWORD` / `SHIPROCKET_PICKUP_LOCATION` /
`SHIPROCKET_WEBHOOK_TOKEN`, `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` /
`TWILIO_FROM_NUMBER` (or `TWILIO_MESSAGING_SERVICE_SID`), `REQUIRE_ORDER_OTP`.

> **No `NEXT_PUBLIC_API_URL`, `API_URL`, or `REDIS_URL` anymore.** The API is
> part of this Next.js app and is same-origin, and the only Redis use (a PIN
> cache) is now an in-process cache.

## 3. The API ships WITH this app — nothing extra to deploy

The backend used to be a separate Fastify service on Railway. It has been
migrated into Next.js **route handlers** under `apps/web/app/api/**`, so it
deploys as Vercel serverless functions alongside the storefront in the same
build. There is **no second service, no Railway, no Redis** to stand up.

- Browser calls hit `/api/*` on the same origin (cart cookies stay
  first-party — the old cross-site proxy is gone).
- Server components self-fetch the same `/api/*` routes via the deployment
  origin (`VERCEL_URL`), or you can import the service functions in
  `apps/web/lib/server/services/**` directly to skip the HTTP hop.

If you ever add genuinely long-running work (background jobs beyond the
serverless timeout, persistent WebSockets, queue/cron workers), THAT is when
a separate service is warranted — not for the standard request/response
endpoints that live here.

## 4. Database

You need a cloud Postgres. Easiest path:

1. Create a free **Supabase cloud project** at <https://supabase.com>.
2. Run migrations against it from your local machine:
   ```bash
   DATABASE_URL="<cloud-pooler-url>" \
   DIRECT_URL="<cloud-direct-url>" \
   pnpm db:migrate
   pnpm db:seed
   ```
3. Use the same `DATABASE_URL` / `DIRECT_URL` in Vercel (one deploy target now).

## 5. Triggering the deploy

After committing `vercel.json` and adding env vars:

```bash
git push origin development   # or main, whichever you're deploying
```

Or in the Vercel dashboard: **Deployments → Redeploy** (use "Clear build cache" the first time).

## Common 404 causes after vercel.json is added

| Symptom | Fix |
|---|---|
| 404 on every route | `outputDirectory` mismatch — verify `vercel.json` is at repo root and committed |
| 404 only on `/cart`, `/checkout`, `/account/*` | Env var missing or wrong: `NEXT_PUBLIC_SUPABASE_*` |
| 500 on `/api/*` or `/products/[slug]` | A server-side env var the route handlers need is missing (`DATABASE_URL`, `SUPABASE_JWT_SECRET`, etc.) — check the Functions logs |
| 500 on `/admin/*` | Middleware can't reach Supabase — check `NEXT_PUBLIC_SUPABASE_URL` |

## Build output verification

A healthy first deploy log shows:

```
Running "vercel.json" buildCommand
> pnpm --filter @vivasvana/db generate && pnpm --filter @vivasvana/web build
✓ Prisma Client generated
✓ Compiled successfully
✓ Generating static pages
Build Completed in /vercel/output [XX.XXs]
```

If you see "No Next.js version detected" — `outputDirectory` is wrong. If you see "Cannot find module '@vivasvana/db'" — the install command didn't run at the root.
