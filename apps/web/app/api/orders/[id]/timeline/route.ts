import { z } from 'zod';
import { prisma } from '@vivasvana/db';
import { route, parseParams, json, notFound, forbidden } from '@/lib/server/http';
import { requireAuth } from '@/lib/server/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Params = z.object({ id: z.string().uuid() });

// Customer-facing tracking timeline for one of their own orders.
export const GET = route(async (req, ctx) => {
  const user = await requireAuth(req);
  const { id } = await parseParams(ctx, Params);
  const order = await prisma.order.findUnique({ where: { id }, select: { userId: true } });
  if (!order) throw notFound('Order not found');
  if (order.userId !== user.id) throw forbidden('Not your order');
  const events = await prisma.orderEvent.findMany({
    where: { orderId: id },
    orderBy: { createdAt: 'asc' },
  });
  return json({ events });
});
