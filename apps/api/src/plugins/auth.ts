import fp from 'fastify-plugin';
import { jwtVerify } from 'jose';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { env } from '../config/env.js';
import { NotificationService } from '../services/notification.service.js';

/**
 * Auth model:
 *   - Supabase issues a JWT (HS256, signed with SUPABASE_JWT_SECRET).
 *   - Browser sends it as `Authorization: Bearer <token>`.
 *   - We verify it and load the mirror User row (role lives there, not in JWT claims).
 *
 * Two helpers are decorated on `app`:
 *   - app.authenticate     — requires a logged-in user; populates request.user
 *   - app.requireAdmin     — requires authenticate + role === 'ADMIN' or 'STAFF'
 *
 * On routes that need them, set as `preHandler`:
 *   app.get('/me', { preHandler: app.authenticate }, handler)
 */

export interface AuthUser {
  id: string;
  email: string;
  role: 'CUSTOMER' | 'STAFF' | 'ADMIN';
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthUser;
  }
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireAdmin: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    optionalAuth: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

const jwtSecret = () => new TextEncoder().encode(env.SUPABASE_JWT_SECRET);

async function verifyToken(token: string): Promise<{ sub: string; email: string } | null> {
  try {
    const { payload } = await jwtVerify(token, jwtSecret(), {
      algorithms: ['HS256'],
      audience: 'authenticated',
    });
    if (!payload.sub || typeof payload.sub !== 'string') return null;
    const email = typeof payload.email === 'string' ? payload.email : '';
    return { sub: payload.sub, email };
  } catch {
    return null;
  }
}

function extractToken(req: FastifyRequest): string | null {
  const header = req.headers.authorization;
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  return token;
}

export default fp(
  async (app) => {
    const notifications = new NotificationService(app.prisma);

    /**
     * Load (or lazily create) the mirror User row for a verified Supabase JWT.
     *
     * Supabase Auth owns auth.users; we mirror to public.users so domain tables
     * can FK to a single id. On first authenticated request from a new signup,
     * the JWT is already verified, so it's safe to upsert a CUSTOMER row. Role
     * promotion to ADMIN/STAFF happens via SQL/admin tools, not on signup.
     */
    const loadUser = async (claims: { sub: string; email: string }): Promise<AuthUser | null> => {
      const existing = await app.prisma.user.findUnique({
        where: { id: claims.sub },
        select: { id: true, email: true, role: true, deletedAt: true },
      });
      if (existing) {
        if (existing.deletedAt) return null;
        return { id: existing.id, email: existing.email, role: existing.role };
      }
      // First seen — mirror Supabase identity into our domain user table
      // and fire the welcome email asynchronously.
      const created = await app.prisma.user.create({
        data: { id: claims.sub, email: claims.email || `${claims.sub}@user.local`, role: 'CUSTOMER' },
        select: { id: true, email: true, role: true },
      });
      void notifications.sendWelcome({ email: created.email });
      return created;
    };

    app.decorate('authenticate', async (req: FastifyRequest, reply: FastifyReply) => {
      const token = extractToken(req);
      if (!token) return reply.unauthorized('missing bearer token');
      const claims = await verifyToken(token);
      if (!claims) return reply.unauthorized('invalid or expired token');
      const user = await loadUser(claims);
      if (!user) return reply.unauthorized('user not found');
      req.user = user;
    });

    app.decorate('optionalAuth', async (req: FastifyRequest) => {
      const token = extractToken(req);
      if (!token) return;
      const claims = await verifyToken(token);
      if (!claims) return;
      const user = await loadUser(claims);
      if (user) req.user = user;
    });

    app.decorate('requireAdmin', async (req: FastifyRequest, reply: FastifyReply) => {
      // Dev-only bypass: when ADMIN_AUTH_DISABLED is set AND we are NOT in
      // production, treat every request as a logged-in stub admin. The
      // NODE_ENV gate is intentional — even if the flag is mistakenly set
      // in prod env vars, prod refuses to honor it.
      if (env.NODE_ENV !== 'production' && env.ADMIN_AUTH_DISABLED) {
        req.user = {
          id: '00000000-0000-0000-0000-000000000001',
          email: 'dev@local',
          role: 'ADMIN',
        };
        app.log.warn('admin auth bypassed (ADMIN_AUTH_DISABLED=true, dev only)');
        return;
      }
      await app.authenticate(req, reply);
      if (reply.sent) return;
      if (!req.user || (req.user.role !== 'ADMIN' && req.user.role !== 'STAFF')) {
        return reply.forbidden('admin access required');
      }
    });
  },
  { name: 'auth', dependencies: ['prisma'] },
);
