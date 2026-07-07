import { z } from 'zod';
import { after } from 'next/server';
import { prisma } from '@vivasvana/db';
import { PaymentService } from '@/lib/server/services/payment.service';
import { NotificationService } from '@/lib/server/services/notification.service';
import { serializeMoney } from '@/lib/server/lib/decimal';
import { route, parseBody, parseParams, json } from '@/lib/server/http';
import { mapPaymentError, autoPushToShiprocket } from '../../confirm-shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Params = z.object({ orderId: z.string().uuid() });
const Body = z.object({
  success: z.boolean(),
  failureReason: z.string().max(200).optional(),
});

export const POST = route(async (req, ctx) => {
  const { orderId } = await parseParams(ctx, Params);
  const body = await parseBody(req, Body);
  const service = new PaymentService(prisma);

  try {
    const order = await service.confirmMock(orderId, body);
    if (body.success) {
      after(() => {
        const notifications = new NotificationService(prisma);
        return notifications
          .sendOrderConfirmation(order.id)
          .catch((e) => console.error('[payments] order confirmation failed', e));
      });
      after(() => autoPushToShiprocket(order.id));
    }
    return json(serializeMoney(order));
  } catch (err) {
    return mapPaymentError(err);
  }
});
