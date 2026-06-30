import { z } from 'zod';
import { prisma } from '@vivasvana/db';
import { CustomerService } from '@/lib/server/services/customer.service';
import { serializeMoney } from '@/lib/server/lib/decimal';
import { route, parseQuery, json } from '@/lib/server/http';
import { requirePermission } from '@/lib/server/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ListQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(25),
  search: z.string().min(1).max(120).optional(),
  hasOrders: z.coerce.boolean().optional(),
  sort: z
    .enum(['createdAt-desc', 'createdAt-asc', 'spend-desc', 'orders-desc', 'name-asc'])
    .default('createdAt-desc'),
});

export const GET = route(async (req) => {
  await requirePermission(req, 'view_customers');
  const query = parseQuery(req, ListQuery);
  const customers = new CustomerService(prisma);
  return json(serializeMoney(await customers.adminList(query)));
});
