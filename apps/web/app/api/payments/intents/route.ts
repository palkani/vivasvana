import { z } from 'zod';
import { prisma } from '@vivasvana/db';
import { PaymentService } from '@/lib/server/services/payment.service';
import { route, parseBody, json, notFound, conflict, badRequest } from '@/lib/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const IntentBody = z.object({ orderId: z.string().uuid() });

export const POST = route(async (req) => {
  const body = await parseBody(req, IntentBody);
  const order = await prisma.order.findUnique({ where: { id: body.orderId } });
  if (!order) throw notFound('Order not found');
  if (order.status !== 'PENDING') throw conflict('Order is no longer pending');
  if (order.paymentMethod === 'COD') throw badRequest('COD orders do not use intents');

  const service = new PaymentService(prisma);
  const intent = await service.createMockIntent(order);
  return json(intent, { status: 201 });
});
