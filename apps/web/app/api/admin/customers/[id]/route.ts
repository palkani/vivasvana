import { z } from 'zod';
import { prisma } from '@vivasvana/db';
import { CustomerService } from '@/lib/server/services/customer.service';
import { serializeMoney } from '@/lib/server/lib/decimal';
import { route, parseParams, json, notFound } from '@/lib/server/http';
import { requirePermission } from '@/lib/server/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const IdParam = z.object({ id: z.string().uuid() });

export const GET = route(async (req, ctx) => {
  await requirePermission(req, 'view_customers');
  const { id } = await parseParams(ctx, IdParam);
  const customers = new CustomerService(prisma);
  const customer = await customers.adminGet(id);
  if (!customer) throw notFound('Customer not found');
  return json(serializeMoney(customer));
});
