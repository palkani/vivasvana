import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { DiscountService } from '../services/discount.service.js';

const ValidateBody = z.object({
  code: z.string().min(2).max(40),
  subtotal: z.coerce.number().min(0),
});

const discountRoutes: FastifyPluginAsyncZod = async (app) => {
  const service = new DiscountService(app.prisma);

  app.post(
    '/api/discount/validate',
    {
      preHandler: app.optionalAuth,
      schema: {
        tags: ['discounts'],
        summary: 'Validate a discount code against a subtotal',
        body: ValidateBody,
      },
    },
    async (req) =>
      service.validate({
        code: req.body.code,
        subtotal: req.body.subtotal,
        userId: req.user?.id,
      }),
  );
};

export default discountRoutes;

