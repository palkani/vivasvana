import { z } from 'zod';
import { prisma } from '@vivasvana/db';
import { OrderService } from '@/lib/server/services/order.service';
import { serializeMoney } from '@/lib/server/lib/decimal';
import { route, parseParams, notFound, json } from '@/lib/server/http';
import { requireAuth } from '@/lib/server/auth';
import { mapServiceError } from '../../route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Params = z.object({ id: z.string().uuid() });

// -- Cancel my pending order (auth) ------------------------------------
export const POST = route(async (req, ctx) => {
  const user = await requireAuth(req);
  const { id } = await parseParams(ctx, Params);

  // Confirm ownership before passing to service
  const owned = await prisma.order.findFirst({
    where: { id, userId: user.id },
    select: { id: true },
  });
  if (!owned) throw notFound('Order not found');

  const service = new OrderService(prisma);
  try {
    const cancelled = await service.cancelPending(owned.id);
    return json(serializeMoney(cancelled));
  } catch (err) {
    return mapServiceError(err);
  }
});
