import { z } from 'zod';
import { prisma } from '@vivasvana/db';
import { StaffService } from '@/lib/server/services/staff.service';
import { STAFF_ROLE_DESCRIPTIONS } from '@/lib/server/lib/permissions';
import { route, parseBody, json, badRequest, conflict, forbidden, notFound, HttpError } from '@/lib/server/http';
import { requireAdmin } from '@/lib/server/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const StaffRoleEnum = z.enum(['MANAGER', 'ORDER_MANAGER', 'SUPPORT', 'CONTENT_EDITOR', 'INVENTORY']);

const PromoteBody = z.object({
  email: z.string().trim().email(),
  staffRole: StaffRoleEnum,
});

function mapStaffError(err: unknown): never {
  if (err instanceof Error) {
    if (err.message === 'PENDING_SIGNUP') {
      throw new HttpError(
        409,
        'Conflict',
        'No account found for that email. Ask them to sign up at /admin/login first, then add them here.',
        { statusCode: 409, code: 'PENDING_SIGNUP' },
      );
    }
    if (err.message === 'USER_NOT_FOUND') throw notFound('User not found');
    if (err.message === 'USER_DELETED') throw badRequest('User account is deleted');
    if (err.message === 'ALREADY_ADMIN') {
      throw conflict('That user is already an Admin — no further action needed');
    }
    if (err.message === 'CANNOT_EDIT_ADMIN') {
      throw forbidden("Admin accounts can't be edited via this UI — promote/demote in the database");
    }
    if (err.message === 'CANNOT_EDIT_SELF') throw forbidden("You can't edit your own role");
    if (err.message === 'CANNOT_REVOKE_ADMIN') throw forbidden('Cannot revoke another admin');
    if (err.message === 'CANNOT_REVOKE_SELF') throw forbidden("You can't revoke your own access");
    if (err.message === 'EMAIL_REQUIRED') throw badRequest('Email is required');
  }
  throw err;
}

export const GET = route(async (req) => {
  await requireAdmin(req);
  const service = new StaffService(prisma);
  return json({
    items: await service.list(),
    roles: STAFF_ROLE_DESCRIPTIONS,
  });
});

export const POST = route(async (req) => {
  const user = await requireAdmin(req);
  const body = await parseBody(req, PromoteBody);
  const service = new StaffService(prisma);
  try {
    return json(
      await service.promote({
        email: body.email,
        staffRole: body.staffRole,
        invitedById: user.id,
      }),
      { status: 201 },
    );
  } catch (err) {
    mapStaffError(err);
  }
});
