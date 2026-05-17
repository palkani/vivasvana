import fp from 'fastify-plugin';
import { jwtVerify } from 'jose';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { env } from '../config/env.js';

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
    const loadUser = async (claims: { sub: string; email: string }): Promise<AuthUser | null> => {
      const row = await app.prisma.user.findUnique({
        where: { id: claims.sub },
        select: { id: true, email: true, role: true, deletedAt: true },
      });
      if (!row || row.deletedAt) return null;
      return { id: row.id, email: row.email, role: row.role };
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
      await app.authenticate(req, reply);
      if (reply.sent) return;
      if (!req.user || (req.user.role !== 'ADMIN' && req.user.role !== 'STAFF')) {
        return reply.forbidden('admin access required');
      }
    });
  },
  { name: 'auth', dependencies: ['prisma'] },
);
