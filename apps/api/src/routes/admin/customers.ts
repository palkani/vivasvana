import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { CustomerService } from '../../services/customer.service.js';
import { serializeMoney } from '../../lib/decimal.js';

const ListQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(25),
  search: z.string().min(1).max(120).optional(),
  hasOrders: z.coerce.boolean().optional(),
  sort: z
    .enum(['createdAt-desc', 'createdAt-asc', 'spend-desc', 'orders-desc', 'name-asc'])
    .default('createdAt-desc'),
});

const IdParam = z.object({ id: z.string().uuid() });

export default async function adminCustomerRoutes(app: FastifyInstance) {
  const customers = new CustomerService(app.prisma);

  app.register(async (admin) => {
    admin.addHook('preHandler', admin.requirePermission('view_customers'));

    admin.get(
      '/api/admin/customers',
      {
        schema: {
          tags: ['admin', 'customers'],
          summary: 'List registered customers with lifetime stats',
          querystring: ListQuery,
          security: [{ bearerAuth: [] }],
        },
      },
      async (req) => serializeMoney(await customers.adminList(req.query)),
    );

    admin.get(
      '/api/admin/customers/:id',
      {
        schema: {
          tags: ['admin', 'customers'],
          summary: 'Get a single customer with addresses and recent orders',
          params: IdParam,
          security: [{ bearerAuth: [] }],
        },
      },
      async (req, reply) => {
        const customer = await customers.adminGet(req.params.id);
        if (!customer) return reply.notFound('Customer not found');
        return serializeMoney(customer);
      },
    );
  });
}
