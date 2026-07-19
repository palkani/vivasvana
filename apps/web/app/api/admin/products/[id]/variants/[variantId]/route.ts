import { z } from 'zod';
import { prisma } from '@vivasvana/db';
import { VariantService } from '@/lib/server/services/variant.service';
import { route, parseParams, parseBody, json, notFound, conflict } from '@/lib/server/http';
import { requirePermission } from '@/lib/server/auth';
import { serializeMoney } from '@/lib/server/lib/decimal';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Params = z.object({
  id: z.string().uuid(),
  variantId: z.string().uuid(),
});

const Decimal2 = z.string().regex(/^\d+(\.\d{1,2})?$/, 'Must be a decimal');

const UpdateBody = z
  .object({
    title: z.string().trim().min(1).max(60),
    sku: z.string().trim().min(1).max(64),
    price: Decimal2,
    salePrice: Decimal2.optional().nullable(),
    stock: z.number().int().nonnegative(),
    weight: Decimal2.optional().nullable(),
    sortOrder: z.number().int(),
  })
  .partial();

function mapError(err: unknown): never {
  if (err instanceof Error) {
    if (err.message === 'VARIANT_NOT_FOUND') throw notFound('Variant not found');
    if (err.message === 'SKU_TAKEN') throw conflict('That SKU is already in use');
  }
  throw err;
}

export const PATCH = route(async (req, ctx) => {
  await requirePermission(req, 'manage_products');
  const { variantId } = await parseParams(ctx, Params);
  const body = await parseBody(req, UpdateBody);
  const service = new VariantService(prisma);
  try {
    return json(serializeMoney(await service.update(variantId, body)));
  } catch (err) {
    mapError(err);
  }
});

export const DELETE = route(async (req, ctx) => {
  await requirePermission(req, 'manage_products');
  const { variantId } = await parseParams(ctx, Params);
  const service = new VariantService(prisma);
  try {
    await service.delete(variantId);
    return new Response(null, { status: 204 });
  } catch (err) {
    mapError(err);
  }
});
