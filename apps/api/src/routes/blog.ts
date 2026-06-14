import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { BlogService } from '../services/blog.service.js';

const ListQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(50).default(12),
  search: z.string().min(1).max(120).optional(),
});

const SlugParam = z.object({ slug: z.string().min(1).max(160) });

const blogRoutes: FastifyPluginAsyncZod = async (app) => {
  const service = new BlogService(app.prisma);

  app.get(
    '/api/blog',
    {
      schema: {
        tags: ['blog'],
        summary: 'Published blog posts (public)',
        querystring: ListQuery,
      },
    },
    async (req) => service.publicList(req.query),
  );

  app.get(
    '/api/blog/:slug',
    {
      schema: {
        tags: ['blog'],
        summary: 'Single blog post by slug (public, published only)',
        params: SlugParam,
      },
    },
    async (req, reply) => {
      const post = await service.publicGet(req.params.slug);
      if (!post) return reply.notFound('Post not found');
      return post;
    },
  );
};

export default blogRoutes;

