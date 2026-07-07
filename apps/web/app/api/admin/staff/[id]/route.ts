import { z } from 'zod';
import { prisma } from '@vivasvana/db';
import { StaffService } from '@/lib/server/services/staff.service';
import {
  route,
  parseParams,
  parseBody,
  json,
  badRequest,
  conflict,
  forbidden,
  notFound,
  HttpError,
} from '@/lib/server/http';
import { requireAdmin } from '@/lib/server/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const StaffRoleEnum = z.enum(['MANAGER', 'ORDER_MANAGER', 'SUPPORT', 'CONTENT_EDITOR', 'INVENTORY']);

const UpdateRoleBody = z.object({
  staffRole: StaffRoleEnum,
});

const IdParam = z.object({ id: z.string().uuid() });

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

export const PATCH = route(async (req, ctx) => {
  const user = await requireAdmin(req);
  const { id } = await parseParams(ctx, IdParam);
  const body = await parseBody(req, UpdateRoleBody);
  const service = new StaffService(prisma);
  try {
    return json(
      await service.updateRole({
        id,
        staffRole: body.staffRole,
        actorId: user.id,
      }),
    );
  } catch (err) {
    mapStaffError(err);
  }
});

export const DELETE = route(async (req, ctx) => {
  const user = await requireAdmin(req);
  const { id } = await parseParams(ctx, IdParam);
  const service = new StaffService(prisma);
  try {
    await service.revoke({ id, actorId: user.id });
    return new Response(null, { status: 204 });
  } catch (err) {
    mapStaffError(err);
  }
});
