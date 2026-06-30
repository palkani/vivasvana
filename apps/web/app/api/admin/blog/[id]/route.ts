import { z } from 'zod';
import { prisma } from '@vivasvana/db';
import { BlogService } from '@/lib/server/services/blog.service';
import { route, parseParams, parseBody, json, notFound } from '@/lib/server/http';
import { requirePermission } from '@/lib/server/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const IdParam = z.object({ id: z.string().uuid() });

const UpdateBody = z
  .object({
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
  })
  .partial();

function rethrow(err: unknown): never {
  if (err instanceof Error && err.message === 'POST_NOT_FOUND') {
    throw notFound('Blog post not found');
  }
  throw err;
}

export const GET = route(async (req, ctx) => {
  await requirePermission(req, 'view_blog');
  const { id } = await parseParams(ctx, IdParam);
  const service = new BlogService(prisma);
  const post = await service.adminGet(id);
  if (!post) throw notFound('Blog post not found');
  return json(post);
});

export const PATCH = route(async (req, ctx) => {
  await requirePermission(req, 'manage_blog');
  const { id } = await parseParams(ctx, IdParam);
  const body = await parseBody(req, UpdateBody);
  const service = new BlogService(prisma);
  try {
    return json(await service.adminUpdate(id, body));
  } catch (err) {
    rethrow(err);
  }
});

export const DELETE = route(async (req, ctx) => {
  await requirePermission(req, 'manage_blog');
  const { id } = await parseParams(ctx, IdParam);
  const service = new BlogService(prisma);
  try {
    await service.adminDelete(id);
    return new Response(null, { status: 204 });
  } catch (err) {
    rethrow(err);
  }
});
