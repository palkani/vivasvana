import { z } from 'zod';
import { prisma } from '@vivasvana/db';
import { BlogService } from '@/lib/server/services/blog.service';
import { route, parseParams, json, notFound } from '@/lib/server/http';
import { requirePermission } from '@/lib/server/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const IdParam = z.object({ id: z.string().uuid() });

export const POST = route(async (req, ctx) => {
  await requirePermission(req, 'manage_blog');
  const { id } = await parseParams(ctx, IdParam);
  const service = new BlogService(prisma);
  try {
    return json(await service.adminArchive(id));
  } catch (err) {
    if (err instanceof Error && err.message === 'POST_NOT_FOUND') {
      throw notFound('Blog post not found');
    }
    throw err;
  }
});
