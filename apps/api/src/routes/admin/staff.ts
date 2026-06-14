import type { FastifyReply } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { StaffService } from '../../services/staff.service.js';
import { STAFF_ROLE_DESCRIPTIONS } from '../../lib/permissions.js';

const StaffRoleEnum = z.enum(['MANAGER', 'ORDER_MANAGER', 'SUPPORT', 'CONTENT_EDITOR', 'INVENTORY']);

const PromoteBody = z.object({
  email: z.string().trim().email(),
  staffRole: StaffRoleEnum,
});

const UpdateRoleBody = z.object({
  staffRole: StaffRoleEnum,
});

const IdParam = z.object({ id: z.string().uuid() });

function mapError(err: unknown, reply: FastifyReply) {
  if (err instanceof Error) {
    if (err.message === 'PENDING_SIGNUP') {
      return reply
        .status(409)
        .send({
          statusCode: 409,
          error: 'Conflict',
          code: 'PENDING_SIGNUP',
          message:
            'No account found for that email. Ask them to sign up at /admin/login first, then add them here.',
        });
    }
    if (err.message === 'USER_NOT_FOUND') return reply.notFound('User not found');
    if (err.message === 'USER_DELETED') return reply.badRequest('User account is deleted');
    if (err.message === 'ALREADY_ADMIN') {
      return reply.conflict('That user is already an Admin — no further action needed');
    }
    if (err.message === 'CANNOT_EDIT_ADMIN') {
      return reply.forbidden('Admin accounts can\'t be edited via this UI — promote/demote in the database');
    }
    if (err.message === 'CANNOT_EDIT_SELF') return reply.forbidden('You can\'t edit your own role');
    if (err.message === 'CANNOT_REVOKE_ADMIN') return reply.forbidden('Cannot revoke another admin');
    if (err.message === 'CANNOT_REVOKE_SELF') return reply.forbidden('You can\'t revoke your own access');
    if (err.message === 'EMAIL_REQUIRED') return reply.badRequest('Email is required');
  }
  throw err;
}

const adminStaffRoutes: FastifyPluginAsyncZod = async (app) => {
  const service = new StaffService(app.prisma);

  // ALL staff-management endpoints require true ADMIN, not just any
  // staff role. This is intentional — adding employees is an owner-level
  // operation and must not be delegatable to staff with manage_X permissions.
  app.register(async (admin: typeof app) => {
    admin.addHook('preHandler', admin.requireAdmin);

    admin.get(
      '/api/admin/staff',
      {
        schema: {
          tags: ['admin', 'staff'],
          summary: 'List all staff and admin accounts',
          security: [{ bearerAuth: [] }],
        },
      },
      async () => ({
        items: await service.list(),
        roles: STAFF_ROLE_DESCRIPTIONS,
      }),
    );

    admin.post(
      '/api/admin/staff',
      {
        schema: {
          tags: ['admin', 'staff'],
          summary: 'Add a staff member by email (must be an existing user account)',
          body: PromoteBody,
          security: [{ bearerAuth: [] }],
        },
      },
      async (req, reply) => {
        if (!req.user) return reply.unauthorized();
        try {
          return reply.code(201).send(
            await service.promote({
              email: req.body.email,
              staffRole: req.body.staffRole,
              invitedById: req.user.id,
            }),
          );
        } catch (err) {
          return mapError(err, reply);
        }
      },
    );

    admin.patch(
      '/api/admin/staff/:id',
      {
        schema: {
          tags: ['admin', 'staff'],
          summary: 'Change a staff member\'s role',
          params: IdParam,
          body: UpdateRoleBody,
          security: [{ bearerAuth: [] }],
        },
      },
      async (req, reply) => {
        if (!req.user) return reply.unauthorized();
        try {
          return await service.updateRole({
            id: req.params.id,
            staffRole: req.body.staffRole,
            actorId: req.user.id,
          });
        } catch (err) {
          return mapError(err, reply);
        }
      },
    );

    admin.post(
      '/api/admin/staff/:id/promote-admin',
      {
        schema: {
          tags: ['admin', 'staff'],
          summary: 'Promote a staff member to full Admin (irreversible from UI)',
          params: IdParam,
          security: [{ bearerAuth: [] }],
        },
      },
      async (req, reply) => {
        if (!req.user) return reply.unauthorized();
        try {
          return await service.promoteToAdmin({
            id: req.params.id,
            actorId: req.user.id,
          });
        } catch (err) {
          return mapError(err, reply);
        }
      },
    );

    admin.delete(
      '/api/admin/staff/:id',
      {
        schema: {
          tags: ['admin', 'staff'],
          summary: 'Revoke staff access (downgrade to CUSTOMER)',
          params: IdParam,
          security: [{ bearerAuth: [] }],
        },
      },
      async (req, reply) => {
        if (!req.user) return reply.unauthorized();
        try {
          await service.revoke({ id: req.params.id, actorId: req.user.id });
          return reply.code(204).send();
        } catch (err) {
          return mapError(err, reply);
        }
      },
    );
  });
};

export default adminStaffRoutes;

