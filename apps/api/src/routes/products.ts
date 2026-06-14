import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { ProductService } from '../services/product.service.js';
import { serializeMoney } from '../lib/decimal.js';

const ListQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(60).default(12),
  sort: z.enum(['newest', 'price-asc', 'price-desc', 'bestseller']).default('newest'),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  isVegan: z.coerce.boolean().optional(),
  isGlutenFree: z.coerce.boolean().optional(),
  category: z.string().optional(),
  search: z.string().optional(),
});

const productRoutes: FastifyPluginAsyncZod = async (app) => {
  const service = new ProductService(app.prisma);

  app.get(
    '/api/products',
    {
      schema: {
        tags: ['products'],
        summary: 'List published products',
        querystring: ListQuery,
      },
    },
    async (req) => {
      const result = await service.list({ ...req.query, status: 'PUBLISHED' });
      return serializeMoney(result);
    },
  );

  app.get(
    '/api/products/:slug',
    {
      schema: {
        tags: ['products'],
        summary: 'Get a published product by slug',
        params: z.object({ slug: z.string().min(1) }),
      },
    },
    async (req, reply) => {
      const product = await service.getBySlug(req.params.slug);
      if (!product) return reply.notFound('Product not found');
      return serializeMoney(product);
    },
  );
};

export default productRoutes;

