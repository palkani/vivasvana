import { z } from 'zod';
import { prisma } from '@vivasvana/db';
import { ReviewService } from '@/lib/server/services/review.service';
import { route, parseParams, parseBody, json, badRequest, notFound } from '@/lib/server/http';
import { optionalAuth } from '@/lib/server/auth';
import { rateLimit, clientIp } from '@/lib/server/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SlugParam = z.object({ slug: z.string().min(1).max(200) });

const SubmitBody = z.object({
  authorName: z.string().trim().min(2).max(80),
  rating: z.coerce.number().int().min(1).max(5),
  title: z.string().trim().max(120).optional().nullable(),
  content: z.string().trim().min(10).max(5000),
});

function mapError(err: unknown): never {
  if (err instanceof Error) {
    if (err.message === 'PRODUCT_NOT_FOUND') throw notFound('Product not found');
    if (err.message === 'INVALID_RATING') throw badRequest('Rating must be between 1 and 5');
    if (err.message === 'CONTENT_TOO_SHORT')
      throw badRequest('Please write at least a few words about the product');
    if (err.message === 'CONTENT_TOO_LONG') throw badRequest('Review is too long');
    if (err.message === 'NAME_REQUIRED') throw badRequest('Please enter your name');
  }
  throw err;
}

async function resolveProductId(slug: string): Promise<string> {
  const product = await prisma.product.findUnique({ where: { slug }, select: { id: true } });
  if (!product) throw notFound('Product not found');
  return product.id;
}

export const GET = route(async (req, ctx) => {
  const { slug } = await parseParams(ctx, SlugParam);
  const productId = await resolveProductId(slug);
  const service = new ReviewService(prisma);
  return json(await service.listApprovedForProduct(productId));
});

export const POST = route(async (req, ctx) => {
  rateLimit(`review:${clientIp(req)}`, 5, 10 * 60 * 1000);
  const { slug } = await parseParams(ctx, SlugParam);
  const productId = await resolveProductId(slug);
  const body = await parseBody(req, SubmitBody);
  const user = await optionalAuth(req);

  const service = new ReviewService(prisma);
  try {
    const review = await service.submit({
      productId,
      userId: user?.id ?? null,
      authorName: body.authorName,
      rating: body.rating,
      title: body.title ?? null,
      content: body.content,
    });
    return json(review, { status: 201 });
  } catch (err) {
    mapError(err);
  }
});