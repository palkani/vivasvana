# @vivasvana/db

Prisma schema + client singleton, shared by `apps/api` and `apps/web`.

## Usage

```ts
import { prisma } from '@vivasvana/db';
import type { Product, OrderStatus } from '@vivasvana/db/types';
```

## Scripts (run from repo root)

| Command | What |
|---|---|
| `pnpm db:generate` | Generate Prisma client |
| `pnpm db:migrate` | Create + apply a new dev migration (interactive) |
| `pnpm --filter @vivasvana/db migrate:deploy` | Apply migrations (CI/prod) |
| `pnpm db:seed` | Seed 3 products, testimonials, blog post, admin user row, welcome discount |
| `pnpm db:reset` | Drop, re-migrate, re-seed |
| `pnpm db:studio` | Open Prisma Studio at http://localhost:5555 |

## Seeding the admin user

The seed creates a `User` row with `id = 00000000-0000-0000-0000-000000000001` and `role = ADMIN`. To log in, create a matching Supabase auth user with the **same UUID** so FK joins resolve:

1. Open Supabase Studio (http://localhost:54323).
2. Auth → Users → Add user → set UUID to `00000000-0000-0000-0000-000000000001`, email to `admin@vivasvana.local`, choose a password.
3. Log in via the storefront — admin routes should now be accessible.

(We will add a CLI helper for this in Phase 2.)

## Money

All monetary values are `Decimal(10, 2)` in INR. Convert to/from string when serializing JSON (Prisma's `Decimal` does not round-trip safely as a JS number).
