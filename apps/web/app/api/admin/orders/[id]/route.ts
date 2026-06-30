import { z } from 'zod';
import { prisma } from '@vivasvana/db';
import { OrderService } from '@/lib/server/services/order.service';
import { serializeMoney } from '@/lib/server/lib/decimal';
import { route, parseParams, notFound, json } from '@/lib/server/http';
import { requirePermission } from '@/lib/server/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const IdParam = z.object({ id: z.string().uuid() });

// Get a single order with items, shipping, payments, customer — read scope.
export const GET = route(async (req, ctx) => {
  await requirePermission(req, 'view_orders');
  const { id } = await parseParams(ctx, IdParam);
  const orders = new OrderService(prisma);
  const order = await orders.adminGet(id);
  if (!order) throw notFound('Order not found');
  return json(serializeMoney(order));
});
