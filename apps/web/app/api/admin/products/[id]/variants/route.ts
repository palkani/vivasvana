import { z } from 'zod';
import { prisma } from '@vivasvana/db';
import { VariantService } from '@/lib/server/services/variant.service';
import { route, parseParams, parseBody, json, notFound, conflict } from '@/lib/server/http';
import { requirePermission } from '@/lib/server/auth';
import { serializeMoney } from '@/lib/server/lib/decimal';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const IdParam = z.object({ id: z.string().uuid() });

const Decimal2 = z.string().regex(/^\d+(\.\d{1,2})?$/, 'Must be a decimal');

const CreateBody = z.object({
  title: z.string().trim().min(1).max(60),
  sku: z.string().trim().min(1).max(64),
  price: Decimal2,
  salePrice: Decimal2.optional().nullable(),
  stock: z.number().int().nonnegative().optional(),
  weight: Decimal2.optional().nullable(),
  sortOrder: z.number().int().optional(),
});

function mapError(err: unknown): never {
  if (err instanceof Error) {
    if (err.message === 'PRODUCT_NOT_FOUND') throw notFound('Product not found');
    if (err.message === 'SKU_TAKEN') throw conflict('That SKU is already in use');
  }
  throw err;
}

export const GET = route(async (req, ctx) => {
  await requirePermission(req, 'view_products');
  const { id } = await parseParams(ctx, IdParam);
  const service = new VariantService(prisma);
  return json(serializeMoney(await service.list(id)));
});

export const POST = route(async (req, ctx) => {
  await requirePermission(req, 'manage_products');
  const { id } = await parseParams(ctx, IdParam);
  const body = await parseBody(req, CreateBody);
  const service = new VariantService(prisma);
  try {
    return json(serializeMoney(await service.create(id, body)), { status: 201 });
  } catch (err) {
    mapError(err);
  }
});
