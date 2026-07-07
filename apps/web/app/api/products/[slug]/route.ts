import { z } from 'zod';
import { prisma } from '@vivasvana/db';
import { ProductService } from '@/lib/server/services/product.service';
import { serializeMoney } from '@/lib/server/lib/decimal';
import { route, parseParams, notFound, json } from '@/lib/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Params = z.object({ slug: z.string().min(1) });

export const GET = route(async (_req, ctx) => {
  const { slug } = await parseParams(ctx, Params);
  const service = new ProductService(prisma);
  const product = await service.getBySlug(slug);
  if (!product) throw notFound('Product not found');
  return json(serializeMoney(product));
});
