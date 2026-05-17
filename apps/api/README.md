# @vivasvana/api

Fastify REST API for the Vivasvana ecommerce platform. Deploys to Railway.

## Run

```bash
pnpm --filter @vivasvana/api dev    # http://localhost:4000
```

Swagger UI: <http://localhost:4000/docs>
Health: <http://localhost:4000/health>
Readiness: <http://localhost:4000/ready>

## Layout

```
src/
├── server.ts          # entrypoint
├── app.ts             # builds the Fastify instance (used by tests too)
├── config/env.ts      # zod-validated process.env
├── plugins/           # prisma, redis, auth, error-handler
├── routes/            # one file per resource
├── services/          # business logic, called by routes
├── lib/               # pure helpers (decimal, order-number)
└── integrations/      # razorpay, shiprocket, resend, india-post (Phase 2+)
```

## Auth

Browser logs in via Supabase Auth (GoTrue) and gets a JWT. It sends `Authorization: Bearer <jwt>` to this API. Plugin verifies the signature with `SUPABASE_JWT_SECRET` then loads the mirror `User` row to read `role`.

Decorators on `app`:
- `app.authenticate` — 401 if no/bad token
- `app.requireAdmin` — 401 then 403 unless role is ADMIN or STAFF
- `app.optionalAuth` — populates `req.user` if a valid token is present, no-op otherwise
