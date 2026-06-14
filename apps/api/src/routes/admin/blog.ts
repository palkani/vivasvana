import type { FastifyReply } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { BlogService } from '../../services/blog.service.js';

const ListQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(25),
  search: z.string().min(1).max(120).optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
});

const CreateBody = z.object({
  slug: z.string().trim().min(1).max(160).optional(),
  title: z.string().trim().min(2).max(220),
  excerpt: z.string().trim().max(500).optional().nullable(),
  content: z.string().min(1),
  featuredImage: z.string().trim().url().max(500).optional().nullable(),
  author: z.string().trim().min(1).max(120),
  authorBio: z.string().trim().max(500).optional().nullable(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
  publishedAt: z.coerce.date().optional().nullable(),
  readingMinutes: z.number().int().positive().optional().nullable(),
  metaTitle: z.string().trim().max(200).optional().nullable(),
  metaDescription: z.string().trim().max(300).optional().nullable(),
});

const UpdateBody = CreateBody.partial();

const IdParam = z.object({ id: z.string().uuid() });

function mapError(err: unknown, reply: FastifyReply) {
  if (err instanceof Error && err.message === 'POST_NOT_FOUND') {
    return reply.notFound('Blog post not found');
  }
  throw err;
}

const adminBlogRoutes: FastifyPluginAsyncZod = async (app) => {
  const service = new BlogService(app.prisma);

  // Read scope.
  app.register(async (admin: typeof app) => {
    admin.addHook('preHandler', admin.requirePermission('view_blog'));

    admin.get(
      '/api/admin/blog',
      {
        schema: {
          tags: ['admin', 'blog'],
          summary: 'List all blog posts (drafts + published + archived)',
          querystring: ListQuery,
          security: [{ bearerAuth: [] }],
        },
      },
      async (req) => service.adminList(req.query),
    );

    admin.get(
      '/api/admin/blog/:id',
      {
        schema: {
          tags: ['admin', 'blog'],
          params: IdParam,
          security: [{ bearerAuth: [] }],
        },
      },
      async (req, reply) => {
        const post = await service.adminGet(req.params.id);
        if (!post) return reply.notFound('Blog post not found');
        return post;
      },
    );

  });

  // Write scope.
  app.register(async (admin: typeof app) => {
    admin.addHook('preHandler', admin.requirePermission('manage_blog'));

    admin.post(
      '/api/admin/blog',
      {
        schema: {
          tags: ['admin', 'blog'],
          summary: 'Create a blog post',
          body: CreateBody,
          security: [{ bearerAuth: [] }],
        },
      },
      async (req, reply) => reply.code(201).send(await service.adminCreate(req.body)),
    );

    admin.patch(
      '/api/admin/blog/:id',
      {
        schema: {
          tags: ['admin', 'blog'],
          summary: 'Update a blog post',
          params: IdParam,
          body: UpdateBody,
          security: [{ bearerAuth: [] }],
        },
      },
      async (req, reply) => {
        try {
          return await service.adminUpdate(req.params.id, req.body);
        } catch (err) {
          return mapError(err, reply);
        }
      },
    );

    admin.post(
      '/api/admin/blog/:id/publish',
      {
        schema: { tags: ['admin', 'blog'], params: IdParam, security: [{ bearerAuth: [] }] },
      },
      async (req, reply) => {
        try {
          return await service.adminPublish(req.params.id);
        } catch (err) {
          return mapError(err, reply);
        }
      },
    );

    admin.post(
      '/api/admin/blog/:id/unpublish',
      {
        schema: { tags: ['admin', 'blog'], params: IdParam, security: [{ bearerAuth: [] }] },
      },
      async (req, reply) => {
        try {
          return await service.adminUnpublish(req.params.id);
        } catch (err) {
          return mapError(err, reply);
        }
      },
    );

    admin.post(
      '/api/admin/blog/:id/archive',
      {
        schema: { tags: ['admin', 'blog'], params: IdParam, security: [{ bearerAuth: [] }] },
      },
      async (req, reply) => {
        try {
          return await service.adminArchive(req.params.id);
        } catch (err) {
          return mapError(err, reply);
        }
      },
    );

    admin.delete(
      '/api/admin/blog/:id',
      {
        schema: { tags: ['admin', 'blog'], params: IdParam, security: [{ bearerAuth: [] }] },
      },
      async (req, reply) => {
        try {
          await service.adminDelete(req.params.id);
          return reply.code(204).send();
        } catch (err) {
          return mapError(err, reply);
        }
      },
    );
  });
};

export default adminBlogRoutes;

