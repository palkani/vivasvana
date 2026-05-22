import type { FastifyInstance } from 'fastify';
import { ALL_PERMISSIONS, STAFF_ROLE_DESCRIPTIONS } from '../../lib/permissions.js';

/**
 * Identity endpoint for the admin shell. Returns who the caller is and what
 * permissions they have so the web sidebar can decide which nav items to show.
 *
 * Gated by view_dashboard — the one permission every staff role + admin has,
 * so it doubles as "is logged into the admin area at all" without making the
 * caller declare a more specific permission. Also honors the dev-mode bypass.
 */
export default async function adminMeRoute(app: FastifyInstance) {
  app.get(
    '/api/admin/me',
    {
      preHandler: app.requirePermission('view_dashboard'),
      schema: {
        tags: ['admin'],
        summary: 'Get the current admin/staff user with permissions',
        security: [{ bearerAuth: [] }],
      },
    },
    async (req) => {
      // Dev-bypass shape — requirePermission has already populated req.user
      // with the stub admin, but we surface a clearer label for the UI.
      if (req.user?.id === '00000000-0000-0000-0000-000000000001') {
        return {
          id: req.user.id,
          email: req.user.email,
          name: null,
          role: 'ADMIN' as const,
          staffRole: null,
          roleLabel: 'Owner / Admin (dev bypass)',
          permissions: ALL_PERMISSIONS,
        };
      }

      if (!req.user) {
        // Should be unreachable because preHandler enforces auth, but keep a
        // safe fallback for typecheck purposes.
        return null;
      }

      const { id, email, role, staffRole, permissions } = req.user;
      const fullUser = await app.prisma.user.findUnique({
        where: { id },
        select: { name: true },
      });
      return {
        id,
        email,
        name: fullUser?.name ?? null,
        role,
        staffRole,
        roleLabel:
          role === 'ADMIN'
            ? 'Owner / Admin'
            : staffRole
              ? STAFF_ROLE_DESCRIPTIONS[staffRole].label
              : 'Staff (no role)',
        permissions,
      };
    },
  );
}
