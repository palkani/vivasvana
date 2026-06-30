import { z } from 'zod';
import { prisma } from '@vivasvana/db';
import { NotificationService } from '@/lib/server/services/notification.service';
import { ShippingService } from '@/lib/server/services/shipping.service';
import {
  route,
  parseParams,
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

// Manual Shiprocket push — fallback for orders the auto-push at payment
// time failed on (Shiprocket down, wallet low, missing dimensions).
// Idempotent: re-pushing a successful order returns the existing shipment
// details without creating a duplicate.
export const POST = route(async (req, ctx) => {
  await requirePermission(req, 'manage_orders');
  const { id } = await parseParams(ctx, IdParam);
  const notifications = new NotificationService(prisma);
  const shipping = new ShippingService(prisma, notifications);
  try {
    const result = await shipping.pushOrder(id);
    if (result.error && !result.shipmentId) {
      return json(
        { error: 'ShippingPushFailed', message: result.error },
        { status: 502 },
      );
    }
    return json(result);
  } catch (err) {
    return mapOrderError(err);
  }
});
