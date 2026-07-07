import { z } from 'zod';
import { prisma } from '@vivasvana/db';
import { OrderService } from '@/lib/server/services/order.service';
import { serializeMoney } from '@/lib/server/lib/decimal';
import { route, parseParams, notFound, json } from '@/lib/server/http';
import { requireAuth } from '@/lib/server/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Params = z.object({ id: z.string().uuid() });

// -- Get one of my orders (auth) ---------------------------------------
export const GET = route(async (req, ctx) => {
  const user = await requireAuth(req);
  const { id } = await parseParams(ctx, Params);
  const service = new OrderService(prisma);
  const order = await service.getForUser(id, user.id);
  if (!order) throw notFound('Order not found');
  return json(serializeMoney(order));
});
