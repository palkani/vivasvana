import fp from 'fastify-plugin';
import { jwtVerify } from 'jose';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { StaffRole, UserRole } from '@vivasvana/db';
import { env } from '../config/env.js';
import { NotificationService } from '../services/notification.service.js';
import {
  ALL_PERMISSIONS,
  permissionsFor,
  hasAnyAdminPermission,
  hasPermission,
  type Permission,
} from '../lib/permissions.js';

/**
 * Auth model:
 *   - Supabase issues a JWT (HS256, signed with SUPABASE_JWT_SECRET).
 *   - Browser sends it as `Authorization: Bearer <token>`.
 *   - We verify it and load the mirror User row (role lives there, not in JWT claims).
 *
 * Helpers decorated on `app`:
 *   - app.authenticate         — requires a logged-in user; populates request.user
 *   - app.requireAdmin         — strict admin-only (delegates to requirePermission('manage_staff'))
 *   - app.requirePermission(p) — preHandler factory; requires staff/admin with the given permission
 *   - app.optionalAuth         — populates request.user if a valid token is present
 */

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  staffRole: StaffRole | null;
  permissions: ReadonlyArray<Permission>;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthUser;
  }
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireAdmin: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requirePermission: (
      perm: Permission,
    ) => (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
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
        select: { id: true, email: true, role: true, staffRole: true, deletedAt: true },
      });
      if (existing) {
        if (existing.deletedAt) return null;
        const resolved = permissionsFor(existing.role, existing.staffRole);
        // Best-effort lastSeenAt update — fire-and-forget so it doesn't block.
        void app.prisma.user
          .update({ where: { id: existing.id }, data: { lastSeenAt: new Date() } })
          .catch(() => {});
        return {
          id: existing.id,
          email: existing.email,
          role: existing.role,
          staffRole: existing.staffRole,
          permissions: resolved.permissions,
        };
      }
      // First seen — mirror Supabase identity into our domain user table
      // and fire the welcome email asynchronously.
      const created = await app.prisma.user.create({
        data: { id: claims.sub, email: claims.email || `${claims.sub}@user.local`, role: 'CUSTOMER' },
        select: { id: true, email: true, role: true, staffRole: true },
      });
      void notifications.sendWelcome({ email: created.email });
      return {
        id: created.id,
        email: created.email,
        role: created.role,
        staffRole: created.staffRole,
        permissions: [],
      };
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

    const applyDevBypass = (req: FastifyRequest): boolean => {
      if (env.NODE_ENV !== 'production' && env.ADMIN_AUTH_DISABLED) {
        req.user = {
          id: '00000000-0000-0000-0000-000000000001',
          email: 'dev@local',
          role: 'ADMIN',
          staffRole: null,
          permissions: ALL_PERMISSIONS,
        };
        app.log.warn('admin auth bypassed (ADMIN_AUTH_DISABLED=true, dev only)');
        return true;
      }
      return false;
    };

    app.decorate('requireAdmin', async (req: FastifyRequest, reply: FastifyReply) => {
      // Reserved for endpoints that must remain ADMIN-only (settings, staff
      // management). STAFF roles cannot reach these even with permissions.
      if (applyDevBypass(req)) return;
      await app.authenticate(req, reply);
      if (reply.sent) return;
      if (!req.user || req.user.role !== 'ADMIN') {
        return reply.forbidden('admin access required');
      }
    });

    app.decorate('requirePermission', (perm: Permission) => {
      return async (req: FastifyRequest, reply: FastifyReply) => {
        if (applyDevBypass(req)) return;
        await app.authenticate(req, reply);
        if (reply.sent) return;
        if (!req.user || !hasAnyAdminPermission(req.user.permissions)) {
          return reply.forbidden('admin access required');
        }
        if (!hasPermission(req.user.permissions, perm)) {
          return reply.forbidden(`missing permission: ${perm}`);
        }
      };
    });
  },
  { name: 'auth', dependencies: ['prisma'] },
);
