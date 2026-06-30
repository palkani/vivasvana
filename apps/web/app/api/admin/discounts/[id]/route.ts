import { z } from 'zod';
import { prisma } from '@vivasvana/db';
import { DiscountService } from '@/lib/server/services/discount.service';
import {
  route,
  parseParams,
  parseBody,
  json,
  badRequest,
  conflict,
  notFound,
} from '@/lib/server/http';
import { requirePermission } from '@/lib/server/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const IdParam = z.object({ id: z.string().uuid() });

const Decimal2 = z.string().regex(/^\d+(\.\d{1,2})?$/, 'Must be a decimal');

const UpdateBody = z
  .object({
    code: z.string().trim().min(2).max(40),
    description: z.string().trim().max(500).optional().nullable(),
    type: z.enum(['PERCENTAGE', 'FIXED_AMOUNT', 'FREE_SHIPPING']),
    value: Decimal2,
    minOrderValue: Decimal2.optional().nullable(),
    maxDiscount: Decimal2.optional().nullable(),
    appliesTo: z.enum(['ALL', 'SPECIFIC_PRODUCTS', 'SPECIFIC_CATEGORIES']).optional(),
    customerScope: z.enum(['ALL', 'NEW_CUSTOMERS', 'LOGGED_IN']).optional(),
    maxUses: z.number().int().nonnegative().optional().nullable(),
    maxUsesPerUser: z.number().int().nonnegative().optional().nullable(),
    validFrom: z.coerce.date().optional().nullable(),
    validUntil: z.coerce.date().optional().nullable(),
    status: z.enum(['ACTIVE', 'EXPIRED', 'DISABLED']).optional(),
  })
  .partial();

function mapError(err: unknown): never {
  if (err instanceof Error) {
    if (err.message === 'DISCOUNT_NOT_FOUND') throw notFound('Discount not found');
    if (err.message === 'CODE_EXISTS') throw conflict('That code is already in use');
    if (err.message === 'VALUE_REQUIRED') throw badRequest('Value must be greater than zero');
    if (err.message === 'PERCENT_TOO_HIGH') throw badRequest('Percentage cannot exceed 100');
    if (err.message === 'INVALID_DATE_RANGE')
      throw badRequest('Valid from must be earlier than valid until');
    if (err.message === 'IN_USE') {
      throw conflict('This discount has been used by orders — archive instead of delete');
    }
  }
  throw err;
}

export const GET = route(async (req, ctx) => {
  await requirePermission(req, 'view_discounts');
  const { id } = await parseParams(ctx, IdParam);
  const service = new DiscountService(prisma);
  const discount = await service.adminGet(id);
  if (!discount) throw notFound('Discount not found');
  return json(discount);
});

export const PATCH = route(async (req, ctx) => {
  await requirePermission(req, 'manage_discounts');
  const { id } = await parseParams(ctx, IdParam);
  const body = await parseBody(req, UpdateBody);
  const service = new DiscountService(prisma);
  try {
    return json(await service.adminUpdate(id, body));
  } catch (err) {
    mapError(err);
  }
});

export const DELETE = route(async (req, ctx) => {
  await requirePermission(req, 'manage_discounts');
  const { id } = await parseParams(ctx, IdParam);
  const service = new DiscountService(prisma);
  try {
    await service.adminDelete(id);
    return new Response(null, { status: 204 });
  } catch (err) {
    mapError(err);
  }
});
