import { prisma } from '@vivasvana/db';
import { route, json } from '@/lib/server/http';
import { requirePermission } from '@/lib/server/auth';
import { ALL_PERMISSIONS, STAFF_ROLE_DESCRIPTIONS } from '@/lib/server/lib/permissions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Identity endpoint for the admin shell. Returns who the caller is and what
 * permissions they have so the web sidebar can decide which nav items to show.
 *
 * Gated by view_dashboard — the one permission every staff role + admin has,
 * so it doubles as "is logged into the admin area at all" without making the
 * caller declare a more specific permission. Also honors the dev-mode bypass.
 */
export const GET = route(async (req) => {
  const user = await requirePermission(req, 'view_dashboard');

  // Dev-bypass shape — requirePermission returns the stub admin, but we
  // surface a clearer label for the UI.
  if (user.id === '00000000-0000-0000-0000-000000000001') {
    return json({
      id: user.id,
      email: user.email,
      name: null,
      role: 'ADMIN' as const,
      staffRole: null,
      roleLabel: 'Owner / Admin (dev bypass)',
      permissions: ALL_PERMISSIONS,
    });
  }

  const { id, email, role, staffRole, permissions } = user;
  const fullUser = await prisma.user.findUnique({
    where: { id },
    select: { name: true },
  });
  return json({
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
  });
});
