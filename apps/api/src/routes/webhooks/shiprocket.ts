import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { ShippingService } from '../../services/shipping.service.js';
import { NotificationService } from '../../services/notification.service.js';

/**
 * Shiprocket tracking webhook receiver.
 *
 * Security: Shiprocket sends the value we set in their dashboard as
 * the `x-api-key` header. We verify it matches SHIPROCKET_WEBHOOK_TOKEN
 * before processing. Constant-time comparison is overkill here (the
 * token is opaque, not a secret derived from user data) but cheap.
 *
 * Body shape is loose because Shiprocket's payload varies by status
 * type (delivery vs RTO vs cancellation). We pluck the fields we need
 * and pass the rest to the service for status mapping.
 *
 * Response: always 200 with a JSON body indicating whether we matched
 * an order. Shiprocket retries on non-2xx — a 4xx for an unknown order
 * would force unnecessary retries. Logged and acknowledged is fine.
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

const shiprocketWebhook: FastifyPluginAsyncZod = async (app) => {
  const notifications = new NotificationService(app.prisma);
  const shipping = new ShippingService(app.prisma, notifications);

  app.post(
    '/api/webhooks/shiprocket',
    {
      schema: {
        tags: ['webhooks'],
        summary: 'Shiprocket tracking status webhook',
        body: WebhookBody,
      },
    },
    async (req, reply) => {
      const headerToken = req.headers['x-api-key'];
      const expected = env.SHIPROCKET_WEBHOOK_TOKEN;

      // When no token is configured we accept the webhook (dev / first-
      // boot). Once SHIPROCKET_WEBHOOK_TOKEN is set we enforce it.
      if (expected) {
        if (typeof headerToken !== 'string' || headerToken !== expected) {
          req.log.warn(
            { hasHeader: typeof headerToken === 'string' },
            'shiprocket webhook rejected — bad token',
          );
          return reply.status(401).send({ error: 'unauthorized' });
        }
      }

      const result = await shipping.handleWebhook({
        awb: req.body.awb,
        current_status: req.body.current_status,
        shipment_status: req.body.shipment_status,
        order_id: req.body.order_id ? String(req.body.order_id) : undefined,
      });

      // Always return 200 — Shiprocket retries on non-2xx and a status
      // we don't recognize isn't worth retrying.
      return reply.status(200).send(result);
    },
  );
};

export default shiprocketWebhook;
