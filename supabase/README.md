# Supabase local stack

Runs Postgres + GoTrue (auth) + Storage + Studio via `supabase start`.

## Quick reference

```bash
supabase start          # boot (first run pulls images, ~2 min)
supabase status         # print URLs + API keys
supabase stop           # halt containers
supabase stop --no-backup --backup-disable    # full reset
```

After `supabase start`, copy the printed `anon key`, `service_role key`, and `JWT secret` into the project `.env` file at the repo root.

## Ports (all on 127.0.0.1)

| Service | Port | Notes |
|---|---|---|
| API gateway | 54321 | What `SUPABASE_URL` points at |
| Postgres | 54322 | What `DATABASE_URL` / `DIRECT_URL` point at |
| Studio | 54323 | Admin UI |
| Inbucket | 54324 | Catches outbound auth emails for inspection |

## Migrations

Database schema is managed by **Prisma**, not by Supabase migrations. We use this Supabase stack purely for **auth, storage, and the Postgres instance**. Run Prisma migrations against it:

```bash
pnpm db:migrate
```

## Storage buckets

We will create buckets via a one-shot script in Phase 2. Buckets used:
- `product-images` (public read)
- `blog-images` (public read)

## Why this and not docker-compose Postgres?

Supabase Auth (GoTrue) needs to sit on top of the same Postgres instance and share the `auth.*` schema with our `public.*` tables. The Supabase CLI wires this correctly out of the box; replicating it in docker-compose is fiddly and drifts from prod behavior.
