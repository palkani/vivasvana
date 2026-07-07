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

const RefundBody = z.object({
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
  reason: z.string().trim().max(500).optional(),
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

// Record a refund (full or partial). Phase 3 wires to Razorpay refund API.
export const POST = route(async (req, ctx) => {
  await requirePermission(req, 'manage_orders');
  const { id } = await parseParams(ctx, IdParam);
  const body = await parseBody(req, RefundBody);
  const orders = new OrderService(prisma);
  try {
    return json(serializeMoney(await orders.adminRefund(id, body)));
  } catch (err) {
    return mapOrderError(err);
  }
});
