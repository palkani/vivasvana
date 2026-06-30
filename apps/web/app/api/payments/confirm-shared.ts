import { prisma } from '@vivasvana/db';
import { NotificationService } from '@/lib/server/services/notification.service';
import { ShippingService } from '@/lib/server/services/shipping.service';
import { notFound, conflict, badRequest } from '@/lib/server/http';

/**
 * Map PaymentService domain errors to HTTP errors — mirrors the Fastify
 * `mapPaymentError`. Unknown errors re-throw so `route()` returns a 500.
 */
export function mapPaymentError(err: unknown): never {
  if (err instanceof Error) {
    if (err.message === 'ORDER_NOT_FOUND') throw notFound('Order not found');
    if (err.message === 'ORDER_NOT_PENDING') throw conflict('Order is no longer pending');
    if (err.message === 'NOT_COD_ORDER') throw badRequest('Order is not COD');
    if (err.message === 'NO_PENDING_PAYMENT') throw conflict('No pending payment to confirm');
  }
  throw err;
}

/**
 * Fire the Shiprocket push as fire-and-forget so a slow/failed courier-
 * aggregator call can NEVER hold up the payment-confirm response. Idempotent —
 * if it fails, an admin can retry via the admin push-to-shiprocket endpoint.
 * (Ported from the Fastify route's `autoPushToShiprocket`.)
 */
export async function autoPushToShiprocket(orderId: string) {
  const notifications = new NotificationService(prisma);
  const shipping = new ShippingService(prisma, notifications);
  try {
    const res = await shipping.pushOrder(orderId);
    if (res.error) {
      console.warn('[shiprocket] auto-push had an issue', { orderId, error: res.error });
    } else if (res.pushed) {
      console.info('[shiprocket] auto-push succeeded', {
        orderId,
        shipmentId: res.shipmentId,
        awbCode: res.awbCode,
        courier: res.courierName,
      });
    }
  } catch (err) {
    console.error('[shiprocket] auto-push threw', { orderId, err });
  }
}
