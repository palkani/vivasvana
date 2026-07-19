import { z } from 'zod';
import { prisma } from '@vivasvana/db';
import { route, parseParams, json } from '@/lib/server/http';
import { requirePermission } from '@/lib/server/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Params = z.object({ id: z.string().uuid() });

// Admin tracking timeline for any order.
export const GET = route(async (req, ctx) => {
  await requirePermission(req, 'view_orders');
  const { id } = await parseParams(ctx, Params);
  const events = await prisma.orderEvent.findMany({
    where: { orderId: id },
    orderBy: { createdAt: 'asc' },
  });
  return json({ events });
});
