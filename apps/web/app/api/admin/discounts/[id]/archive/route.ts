import { z } from 'zod';
import { prisma } from '@vivasvana/db';
import { DiscountService } from '@/lib/server/services/discount.service';
import { route, parseParams, json, badRequest, conflict, notFound } from '@/lib/server/http';
import { requirePermission } from '@/lib/server/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const IdParam = z.object({ id: z.string().uuid() });

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

export const POST = route(async (req, ctx) => {
  await requirePermission(req, 'manage_discounts');
  const { id } = await parseParams(ctx, IdParam);
  const service = new DiscountService(prisma);
  try {
    return json(await service.adminArchive(id));
  } catch (err) {
    mapError(err);
  }
});
