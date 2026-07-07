import { z } from 'zod';
import { prisma } from '@vivasvana/db';
import { serializeMoney } from '@/lib/server/lib/decimal';
import { route, parseParams, notFound, json } from '@/lib/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Params = z.object({ id: z.string().uuid() });

// -- Public lookup by UUID (used by /pay/:orderId during checkout) ------
// The order ID is a v4 UUID, so the URL itself is the capability. We DO NOT
// return payment details here — just enough to render the payment page.
export const GET = route(async (_req, ctx) => {
  const { id } = await parseParams(ctx, Params);
  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: true, shippingAddress: true },
  });
  if (!order) throw notFound('Order not found');
  return json(serializeMoney(order));
});
