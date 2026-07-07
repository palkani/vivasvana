import { jwtVerify } from 'jose';
import { prisma } from '@vivasvana/db';
import type { StaffRole, UserRole } from '@vivasvana/db';
import { env } from './config/env';
import { NotificationService } from './services/notification.service';
import {
  ALL_PERMISSIONS,
  permissionsFor,
  hasAnyAdminPermission,
  hasPermission,
  type Permission,
} from './lib/permissions';
import { forbidden, unauthorized } from './http';

/**
 * Auth, ported from the Fastify `auth` plugin to plain request-scoped
 * helpers — no decorators, no preHandlers. Each route handler calls one of:
 *
 *   - requireAuth(req)            → AuthUser, or throws 401
 *   - optionalAuth(req)           → AuthUser | null (never throws on missing)
 *   - requireAdmin(req)           → AuthUser (ADMIN role), or throws 401/403
 *   - requirePermission(req, perm)→ AuthUser with the permission, or 401/403
 *
 * Auth model is unchanged: Supabase issues an HS256 JWT, the browser sends
 * it as `Authorization: Bearer <token>`, we verify it and load the mirror
 * `public.users` row (role lives there, not in JWT claims).
 */

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  staffRole: StaffRole | null;
  permissions: ReadonlyArray<Permission>;
}

const notifications = new NotificationService(prisma);

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

function extractToken(req: Request): string | null {
  const header = req.headers.get('authorization');
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  return token;
}

/**
 * Load (or lazily create) the mirror User row for a verified Supabase JWT.
 * On first authenticated request from a new signup the JWT is already
 * verified, so it's safe to upsert a CUSTOMER row and fire the welcome email.
 */
async function loadUser(claims: { sub: string; email: string }): Promise<AuthUser | null> {
  const existing = await prisma.user.findUnique({
    where: { id: claims.sub },
    select: { id: true, email: true, role: true, staffRole: true, deletedAt: true },
  });
  if (existing) {
    if (existing.deletedAt) return null;
    const resolved = permissionsFor(existing.role, existing.staffRole);
    // Best-effort lastSeenAt update — fire-and-forget so it doesn't block.
    void prisma.user
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
  const created = await prisma.user.create({
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
}

/** Populate the user if a valid token is present; never throws. */
export async function optionalAuth(req: Request): Promise<AuthUser | null> {
  const token = extractToken(req);
  if (!token) return null;
  const claims = await verifyToken(token);
  if (!claims) return null;
  return loadUser(claims);
}

/** Require a logged-in user; throws 401 otherwise. */
export async function requireAuth(req: Request): Promise<AuthUser> {
  const token = extractToken(req);
  if (!token) throw unauthorized('missing bearer token');
  const claims = await verifyToken(token);
  if (!claims) throw unauthorized('invalid or expired token');
  const user = await loadUser(claims);
  if (!user) throw unauthorized('user not found');
  return user;
}

/**
 * Dev-only bypass — IGNORED in production. Mirrors the Fastify plugin's
 * ADMIN_AUTH_DISABLED escape hatch so local admin work doesn't need a JWT.
 */
function devBypass(): AuthUser | null {
  if (env.NODE_ENV !== 'production' && env.ADMIN_AUTH_DISABLED) {
    return {
      id: '00000000-0000-0000-0000-000000000001',
      email: 'dev@local',
      role: 'ADMIN',
      staffRole: null,
      permissions: ALL_PERMISSIONS,
    };
  }
  return null;
}

/** Strict ADMIN-only (settings, staff management). STAFF cannot reach these. */
export async function requireAdmin(req: Request): Promise<AuthUser> {
  const bypass = devBypass();
  if (bypass) return bypass;
  const user = await requireAuth(req);
  if (user.role !== 'ADMIN') throw forbidden('admin access required');
  return user;
}

/** Require a staff/admin user holding a specific permission. */
export async function requirePermission(req: Request, perm: Permission): Promise<AuthUser> {
  const bypass = devBypass();
  if (bypass) return bypass;
  const user = await requireAuth(req);
  if (!hasAnyAdminPermission(user.permissions)) throw forbidden('admin access required');
  if (!hasPermission(user.permissions, perm)) throw forbidden(`missing permission: ${perm}`);
  return user;
}
