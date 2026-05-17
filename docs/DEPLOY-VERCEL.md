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
| `NEXT_PUBLIC_API_URL` | URL where your Fastify API runs (see step 3) | Production + Preview |
| `API_URL` | Same as NEXT_PUBLIC_API_URL | Production + Preview |
| `REDIS_URL` | Upstash Redis URL (free tier OK) | Production + Preview |

## 3. The API is NOT deployed by this step

`apps/api` is a Fastify long-running process — **Vercel can't host it** (Vercel only runs serverless functions and Next.js). You have three options:

### Option A — Deploy `apps/api` to Railway (recommended)

```bash
# In a new Railway project:
# 1. Connect this repo
# 2. Set Root Directory to `apps/api`
# 3. Build Command: cd ../.. && pnpm install && pnpm --filter @vivasvana/db generate && pnpm --filter @vivasvana/api build
# 4. Start Command: pnpm --filter @vivasvana/api start
# 5. Add the same env vars from step 2 above (minus the NEXT_PUBLIC_* ones)
# 6. Add API_PORT=4000 and API_HOST=0.0.0.0
```

Railway gives you a `https://your-api.up.railway.app` URL. Set that as `NEXT_PUBLIC_API_URL` and `API_URL` in Vercel.

### Option B — Use Render / Fly / Heroku

Same shape as Railway. You need a host that runs a long-lived Node process.

### Option C — Skip the API for now (Vercel-only smoke test)

If you just want the storefront to render without working cart/checkout, set:

```
NEXT_PUBLIC_API_URL=https://your-vercel-url.vercel.app/api-not-deployed
```

Pages that call the API will gracefully fall back to their empty states (the home page already does this — see the "Products will appear here once the API is reachable" message in `apps/web/app/page.tsx`).

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
3. Use the same `DATABASE_URL` / `DIRECT_URL` in Vercel and Railway.

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
| 404 only on `/cart`, `/checkout`, `/account/*` | Env var missing or wrong: `NEXT_PUBLIC_SUPABASE_*` or `NEXT_PUBLIC_API_URL` |
| 404 on `/products/[slug]` | API not reachable from Vercel — check `NEXT_PUBLIC_API_URL` and CORS allowlist on the API (set `API_CORS_ORIGINS` to your Vercel URL) |
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
