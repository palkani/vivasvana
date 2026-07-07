import { z } from 'zod';
import { prisma } from '@vivasvana/db';
import { DiscountService } from '@/lib/server/services/discount.service';
import {
  route,
  parseQuery,
  parseBody,
  json,
  badRequest,
  conflict,
  notFound,
} from '@/lib/server/http';
import { requirePermission } from '@/lib/server/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ListQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(50),
  status: z.enum(['ACTIVE', 'EXPIRED', 'DISABLED']).optional(),
  type: z.enum(['PERCENTAGE', 'FIXED_AMOUNT', 'FREE_SHIPPING']).optional(),
  search: z.string().min(1).max(120).optional(),
  sort: z
    .enum(['createdAt-desc', 'createdAt-asc', 'usedCount-desc', 'code-asc'])
    .default('createdAt-desc'),
});

const Decimal2 = z.string().regex(/^\d+(\.\d{1,2})?$/, 'Must be a decimal');

const CreateBody = z.object({
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
});

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

export const GET = route(async (req) => {
  await requirePermission(req, 'view_discounts');
  const query = parseQuery(req, ListQuery);
  const service = new DiscountService(prisma);
  return json(await service.adminList(query));
});

export const POST = route(async (req) => {
  await requirePermission(req, 'manage_discounts');
  const body = await parseBody(req, CreateBody);
  const service = new DiscountService(prisma);
  try {
    return json(await service.adminCreate(body), { status: 201 });
  } catch (err) {
    mapError(err);
  }
});
