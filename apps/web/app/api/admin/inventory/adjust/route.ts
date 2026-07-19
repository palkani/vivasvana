import { z } from 'zod';
import { prisma } from '@vivasvana/db';
import { InventoryService } from '@/lib/server/services/inventory.service';
import { route, parseBody, json, badRequest, notFound, conflict } from '@/lib/server/http';
import { requirePermission } from '@/lib/server/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Manual stock changes use the ADJUSTMENT reason by default, but allow the
// other physical-count reasons (damage/expiry/returns/POs) so the ledger can
// carry the real story behind the correction.
const AdjustBody = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().optional().nullable(),
  delta: z.coerce
    .number()
    .int()
    .refine((n) => n !== 0, 'Delta must be a non-zero whole number'),
  reason: z
    .enum(['PURCHASE_ORDER', 'SALE', 'RETURN', 'ADJUSTMENT', 'DAMAGED', 'EXPIRED'])
    .default('ADJUSTMENT'),
  notes: z.string().trim().max(1000).optional().nullable(),
  reference: z.string().trim().max(200).optional().nullable(),
});

export const POST = route(async (req) => {
  const user = await requirePermission(req, 'manage_products');
  const body = await parseBody(req, AdjustBody);
  const service = new InventoryService(prisma);
  try {
    const result = await service.adjust({ ...body, createdBy: user.id });
    return json(result, { status: 201 });
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === 'PRODUCT_NOT_FOUND') throw notFound('Product not found');
      if (err.message === 'VARIANT_NOT_FOUND') throw notFound('Variant not found for this product');
      if (err.message === 'NEGATIVE_STOCK') {
        throw conflict('That adjustment would drive stock below zero');
      }
      throw badRequest(err.message);
    }
    throw err;
  }
});