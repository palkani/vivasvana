import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

const testimonialRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/api/testimonials',
    {
      schema: {
        tags: ['testimonials'],
        summary: 'List published testimonials',
        querystring: z.object({
          limit: z.coerce.number().int().positive().max(24).default(6),
        }),
      },
    },
    async (req) => {
      const items = await app.prisma.testimonial.findMany({
        where: { status: 'PUBLISHED' },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        take: req.query.limit,
      });
      return { items };
    },
  );
};

export default testimonialRoutes;

