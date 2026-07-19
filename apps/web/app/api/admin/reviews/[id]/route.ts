import { z } from 'zod';
import { prisma } from '@vivasvana/db';
import { ReviewService } from '@/lib/server/services/review.service';
import { route, parseParams, notFound } from '@/lib/server/http';
import { requirePermission } from '@/lib/server/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const IdParam = z.object({ id: z.string().uuid() });

export const DELETE = route(async (req, ctx) => {
  await requirePermission(req, 'manage_blog');
  const { id } = await parseParams(ctx, IdParam);
  const service = new ReviewService(prisma);
  try {
    await service.adminDelete(id);
    return new Response(null, { status: 204 });
  } catch (err) {
    if (err instanceof Error && err.message === 'REVIEW_NOT_FOUND') throw notFound('Review not found');
    throw err;
  }
});