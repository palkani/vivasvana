import { z } from 'zod';
import { prisma } from '@vivasvana/db';
import { OrderService } from '@/lib/server/services/order.service';
import { serializeMoney } from '@/lib/server/lib/decimal';
import { route, parseQuery, notFound, json } from '@/lib/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LookupQuery = z.object({
  orderNumber: z.string().min(1),
  email: z.string().email(),
});

// -- Public lookup (orderNumber + email) -------------------------------
// Guest confirmation page. The Fastify source registered this as GET with a
// querystring; preserved here as GET.
export const GET = route(async (req) => {
  const { orderNumber, email } = parseQuery(req, LookupQuery);
  const service = new OrderService(prisma);
  const order = await service.getPublic(orderNumber, email);
  if (!order) throw notFound('Order not found');
  return json(serializeMoney(order));
});
