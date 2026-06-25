import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { ShippingService } from '../services/shipping.service.js';
import { NotificationService } from '../services/notification.service.js';

/**
 * Public shipping endpoints. Currently just pincode serviceability —
 * called from the PDP and cart pages to show "delivers in X-Y days".
 * No auth required; rate-limited via the global limiter to discourage
 * bulk pincode scraping.
 */

const CheckBody = z.object({
  pincode: z.string().regex(/^\d{6}$/, '6-digit pincode required'),
  weightKg: z.coerce.number().positive().max(50).default(0.5),
});

const shippingRoutes: FastifyPluginAsyncZod = async (app) => {
  const notifications = new NotificationService(app.prisma);
  const shipping = new ShippingService(app.prisma, notifications);

  app.post(
    '/api/shipping/pincode/check',
    {
      schema: {
        tags: ['shipping'],
        summary: 'Check delivery serviceability + ETA for a pincode',
        body: CheckBody,
      },
    },
    async (req) => {
      return shipping.checkPincode(req.body.pincode, req.body.weightKg);
    },
  );
};

export default shippingRoutes;
