import { z } from 'zod';
import { after } from 'next/server';
import { prisma } from '@vivasvana/db';
import { env } from '@/lib/server/config/env';
import { ShippingService } from '@/lib/server/services/shipping.service';
import { NotificationService } from '@/lib/server/services/notification.service';
import { route, parseBody, json } from '@/lib/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Shiprocket tracking webhook receiver.
 *
 * Security: Shiprocket sends the value we set in their dashboard as the
 * `x-api-key` header. We verify it matches SHIPROCKET_WEBHOOK_TOKEN before
 * processing. When no token is configured we accept the webhook (dev / first
 * boot). NO auth user.
 *
 * Response: always 200 with a JSON body indicating whether we matched an
 * order. Shiprocket retries on non-2xx — a 4xx for an unknown order would
 * force unnecessary retries. The one exception is a bad token → 401.
 */
const WebhookBody = z
  .object({
    awb: z.string().optional(),
    current_status: z.string().optional(),
    shipment_status: z.string().optional(),
    current_status_id: z.coerce.number().optional(),
    shipment_status_id: z.coerce.number().optional(),
    order_id: z.union([z.string(), z.coerce.number()]).optional(),
  })
  .passthrough();

export const POST = route(async (req) => {
  const headerToken = req.headers.get('x-api-key');
  const expected = env.SHIPROCKET_WEBHOOK_TOKEN;

  // When no token is configured we accept the webhook (dev / first-boot).
  // Once SHIPROCKET_WEBHOOK_TOKEN is set we enforce it.
  if (expected) {
    if (typeof headerToken !== 'string' || headerToken !== expected) {
      console.warn('[shiprocket] webhook rejected — bad token', {
        hasHeader: typeof headerToken === 'string',
      });
      return json({ error: 'unauthorized' }, { status: 401 });
    }
  }

  const body = await parseBody(req, WebhookBody);

  const notifications = new NotificationService(prisma);
  const shipping = new ShippingService(prisma, notifications);
  const result = await shipping.handleWebhook({
    awb: body.awb,
    current_status: body.current_status,
    shipment_status: body.shipment_status,
    order_id: body.order_id ? String(body.order_id) : undefined,
  });

  // Send the status SMS AFTER responding — `after()` guarantees it runs
  // without the serverless runtime freezing the function first (a plain
  // fire-and-forget `void` inside the service could be dropped mid-flight).
  if (result.matched && result.orderId && result.notify) {
    const { orderId, notify } = result;
    after(() =>
      notifications
        .sendOrderStatusUpdate(orderId, notify)
        .catch((e) => console.error('[shiprocket] status SMS failed', e)),
    );
  }

  // Always return 200 — Shiprocket retries on non-2xx and a status we don't
  // recognize isn't worth retrying.
  return json(result);
});
