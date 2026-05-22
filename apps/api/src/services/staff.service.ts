import type { PrismaClient, StaffRole } from '@vivasvana/db';
import { Prisma } from '@vivasvana/db';
import { permissionsFor, STAFF_ROLE_DESCRIPTIONS } from '../lib/permissions.js';

/**
 * Staff management lives on top of the existing User table — staff are just
 * users with role = STAFF (or ADMIN) and a non-null staffRole.
 *
 * Adding a new staff member: admin enters their email. If that email exists
 * as a CUSTOMER, we flip them to STAFF + assign a staffRole. If they don't
 * exist yet, we return PENDING_SIGNUP so the admin can ask them to register
 * first — Supabase Auth owns account creation, so we can't create one here
 * without the service-role key wiring.
 */
export class StaffService {
  constructor(private readonly prisma: PrismaClient) {}

  async list() {
    const rows = await this.prisma.user.findMany({
      where: {
        role: { in: ['ADMIN', 'STAFF'] },
        deletedAt: null,
      },
      orderBy: [{ role: 'desc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        staffRole: true,
        invitedAt: true,
        lastSeenAt: true,
        createdAt: true,
        invitedBy: { select: { id: true, email: true, name: true } },
      },
    });

    return rows.map((u) => {
      const resolved = permissionsFor(u.role, u.staffRole);
      return {
        ...u,
        permissions: resolved.permissions,
        roleLabel:
          u.role === 'ADMIN'
            ? 'Owner / Admin'
            : u.staffRole
              ? STAFF_ROLE_DESCRIPTIONS[u.staffRole].label
              : 'Staff (no role)',
      };
    });
  }

  async promote(args: { email: string; staffRole: StaffRole; invitedById: string }) {
    const email = args.email.trim().toLowerCase();
    if (!email) throw new Error('EMAIL_REQUIRED');

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new Error('PENDING_SIGNUP');
    if (user.deletedAt) throw new Error('USER_DELETED');
    if (user.role === 'ADMIN') throw new Error('ALREADY_ADMIN');

    return this.prisma.user.update({
      where: { id: user.id },
      data: {
        role: 'STAFF',
        staffRole: args.staffRole,
        invitedById: args.invitedById,
        invitedAt: new Date(),
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        staffRole: true,
        invitedAt: true,
      },
    });
  }

  async updateRole(args: { id: string; staffRole: StaffRole; actorId: string }) {
    const user = await this.prisma.user.findUnique({ where: { id: args.id } });
    if (!user) throw new Error('USER_NOT_FOUND');
    if (user.role === 'ADMIN') throw new Error('CANNOT_EDIT_ADMIN');
    if (user.id === args.actorId) throw new Error('CANNOT_EDIT_SELF');

    return this.prisma.user.update({
      where: { id: args.id },
      data: { role: 'STAFF', staffRole: args.staffRole },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        staffRole: true,
      },
    });
  }

  /** Revoke staff access — flips back to CUSTOMER, clears staffRole. */
  async revoke(args: { id: string; actorId: string }) {
    const user = await this.prisma.user.findUnique({ where: { id: args.id } });
    if (!user) throw new Error('USER_NOT_FOUND');
    if (user.role === 'ADMIN') throw new Error('CANNOT_REVOKE_ADMIN');
    if (user.id === args.actorId) throw new Error('CANNOT_REVOKE_SELF');

    return this.prisma.user.update({
      where: { id: args.id },
      data: { role: 'CUSTOMER', staffRole: null },
      select: { id: true, email: true, role: true },
    });
  }

  /** Promote staff to ADMIN — only callable by another ADMIN. */
  async promoteToAdmin(args: { id: string; actorId: string }) {
    const user = await this.prisma.user.findUnique({ where: { id: args.id } });
    if (!user) throw new Error('USER_NOT_FOUND');
    if (user.id === args.actorId) throw new Error('CANNOT_EDIT_SELF');
    return this.prisma.user.update({
      where: { id: args.id },
      data: { role: 'ADMIN', staffRole: null },
      select: { id: true, email: true, role: true },
    });
  }

  // Re-exported so the route file doesn't need to import from lib directly.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  static readonly _typeGuard: Prisma.UserWhereInput | undefined = undefined;
}
