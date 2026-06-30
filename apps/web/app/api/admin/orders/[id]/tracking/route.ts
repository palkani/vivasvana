import { z } from 'zod';
import { prisma } from '@vivasvana/db';
import { OrderService } from '@/lib/server/services/order.service';
import { serializeMoney } from '@/lib/server/lib/decimal';
import {
  route,
  parseParams,
  parseBody,
  json,
  notFound,
  conflict,
  badRequest,
  HttpError,
} from '@/lib/server/http';
import { requirePermission } from '@/lib/server/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const IdParam = z.object({ id: z.string().uuid() });

const UpdateTrackingBody = z.object({
  carrier: z.string().trim().min(1).max(80).optional(),
  trackingNumber: z.string().trim().min(3).max(120).optional(),
  trackingUrl: z.string().trim().url().max(500).nullable().optional(),
});

/** Translate OrderService sentinel errors into the matching HTTP responses. */
function mapOrderError(err: unknown): never {
  if (err instanceof HttpError) throw err;
  if (err instanceof Error) {
    if (err.message === 'ORDER_NOT_FOUND') throw notFound('Order not found');
    if (err.message === 'INVALID_TRANSITION') {
      throw conflict('That status transition is not allowed from the current state');
    }
    if (err.message === 'MISSING_SHIPPING_ADDRESS') {
      throw badRequest('Order has no shipping address');
    }
    if (err.message === 'INVALID_REFUND_AMOUNT') throw badRequest('Refund amount must be greater than zero');
    if (err.message === 'REFUND_EXCEEDS_TOTAL') throw badRequest('Refund amount exceeds order total');
  }
  throw err;
}

// Edit tracking info on an already-shipped order.
export const PATCH = route(async (req, ctx) => {
  await requirePermission(req, 'manage_orders');
  const { id } = await parseParams(ctx, IdParam);
  const body = await parseBody(req, UpdateTrackingBody);
  const orders = new OrderService(prisma);
  try {
    const order = await orders.adminUpdateTracking(id, {
      carrier: body.carrier,
      trackingNumber: body.trackingNumber,
      trackingUrl: body.trackingUrl ?? undefined,
    });
    return json(serializeMoney(order));
  } catch (err) {
    return mapOrderError(err);
  }
});
