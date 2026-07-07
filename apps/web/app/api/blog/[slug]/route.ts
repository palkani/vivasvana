import { z } from 'zod';
import { prisma } from '@vivasvana/db';
import { BlogService } from '@/lib/server/services/blog.service';
import { route, parseParams, notFound, json } from '@/lib/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SlugParam = z.object({ slug: z.string().min(1).max(160) });

export const GET = route(async (_req, ctx) => {
  const { slug } = await parseParams(ctx, SlugParam);
  const service = new BlogService(prisma);
  const post = await service.publicGet(slug);
  if (!post) throw notFound('Post not found');
  return json(post);
});
