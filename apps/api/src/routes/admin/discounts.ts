import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { DiscountService } from '../../services/discount.service.js';

const ListQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(50),
  status: z.enum(['ACTIVE', 'EXPIRED', 'DISABLED']).optional(),
  type: z.enum(['PERCENTAGE', 'FIXED_AMOUNT', 'FREE_SHIPPING']).optional(),
  search: z.string().min(1).max(120).optional(),
  sort: z.enum(['createdAt-desc', 'createdAt-asc', 'usedCount-desc', 'code-asc']).default('createdAt-desc'),
});

const Decimal2 = z.string().regex(/^\d+(\.\d{1,2})?$/, 'Must be a decimal');

const CreateBody = z.object({
  code: z.string().trim().min(2).max(40),
  description: z.string().trim().max(500).optional().nullable(),
  type: z.enum(['PERCENTAGE', 'FIXED_AMOUNT', 'FREE_SHIPPING']),
  value: Decimal2,
  minOrderValue: Decimal2.optional().nullable(),
  maxDiscount: Decimal2.optional().nullable(),
  appliesTo: z.enum(['ALL', 'SPECIFIC_PRODUCTS', 'SPECIFIC_CATEGORIES']).optional(),
  customerScope: z.enum(['ALL', 'NEW_CUSTOMERS', 'LOGGED_IN']).optional(),
  maxUses: z.number().int().nonnegative().optional().nullable(),
  maxUsesPerUser: z.number().int().nonnegative().optional().nullable(),
  validFrom: z.coerce.date().optional().nullable(),
  validUntil: z.coerce.date().optional().nullable(),
  status: z.enum(['ACTIVE', 'EXPIRED', 'DISABLED']).optional(),
});

const UpdateBody = CreateBody.partial();

const IdParam = z.object({ id: z.string().uuid() });

function mapError(err: unknown, reply: FastifyReply) {
  if (err instanceof Error) {
    if (err.message === 'DISCOUNT_NOT_FOUND') return reply.notFound('Discount not found');
    if (err.message === 'CODE_EXISTS') return reply.conflict('That code is already in use');
    if (err.message === 'VALUE_REQUIRED') return reply.badRequest('Value must be greater than zero');
    if (err.message === 'PERCENT_TOO_HIGH') return reply.badRequest('Percentage cannot exceed 100');
    if (err.message === 'INVALID_DATE_RANGE') return reply.badRequest('Valid from must be earlier than valid until');
    if (err.message === 'IN_USE') {
      return reply.conflict('This discount has been used by orders — archive instead of delete');
    }
  }
  throw err;
}

export default async function adminDiscountRoutes(app: FastifyInstance) {
  const service = new DiscountService(app.prisma);

  // Read scope.
  app.register(async (admin) => {
    admin.addHook('preHandler', admin.requirePermission('view_discounts'));

    admin.get(
      '/api/admin/discounts',
      {
        schema: {
          tags: ['admin', 'discounts'],
          summary: 'List discounts with filters and usage stats',
          querystring: ListQuery,
          security: [{ bearerAuth: [] }],
        },
      },
      async (req) => service.adminList(req.query),
    );

    admin.get(
      '/api/admin/discounts/:id',
      {
        schema: {
          tags: ['admin', 'discounts'],
          summary: 'Get a single discount with detailed stats',
          params: IdParam,
          security: [{ bearerAuth: [] }],
        },
      },
      async (req, reply) => {
        const discount = await service.adminGet(req.params.id);
        if (!discount) return reply.notFound('Discount not found');
        return discount;
      },
    );

  });

  // Write scope.
  app.register(async (admin) => {
    admin.addHook('preHandler', admin.requirePermission('manage_discounts'));

    admin.post(
      '/api/admin/discounts',
      {
        schema: {
          tags: ['admin', 'discounts'],
          summary: 'Create a discount',
          body: CreateBody,
          security: [{ bearerAuth: [] }],
        },
      },
      async (req, reply) => {
        try {
          return reply.code(201).send(await service.adminCreate(req.body));
        } catch (err) {
          return mapError(err, reply);
        }
      },
    );

    admin.patch(
      '/api/admin/discounts/:id',
      {
        schema: {
          tags: ['admin', 'discounts'],
          summary: 'Update a discount',
          params: IdParam,
          body: UpdateBody,
          security: [{ bearerAuth: [] }],
        },
      },
      async (req, reply) => {
        try {
          return await service.adminUpdate(req.params.id, req.body);
        } catch (err) {
          return mapError(err, reply);
        }
      },
    );

    admin.post(
      '/api/admin/discounts/:id/archive',
      {
        schema: {
          tags: ['admin', 'discounts'],
          summary: 'Soft-disable a discount (status=DISABLED)',
          params: IdParam,
          security: [{ bearerAuth: [] }],
        },
      },
      async (req, reply) => {
        try {
          return await service.adminArchive(req.params.id);
        } catch (err) {
          return mapError(err, reply);
        }
      },
    );

    admin.post(
      '/api/admin/discounts/:id/activate',
      {
        schema: {
          tags: ['admin', 'discounts'],
          summary: 'Reactivate a previously disabled discount',
          params: IdParam,
          security: [{ bearerAuth: [] }],
        },
      },
      async (req, reply) => {
        try {
          return await service.adminActivate(req.params.id);
        } catch (err) {
          return mapError(err, reply);
        }
      },
    );

    admin.delete(
      '/api/admin/discounts/:id',
      {
        schema: {
          tags: ['admin', 'discounts'],
          summary: 'Permanently delete an unused discount (used codes must be archived)',
          params: IdParam,
          security: [{ bearerAuth: [] }],
        },
      },
      async (req, reply) => {
        try {
          await service.adminDelete(req.params.id);
          return reply.code(204).send();
        } catch (err) {
          return mapError(err, reply);
        }
      },
    );
  });
}
