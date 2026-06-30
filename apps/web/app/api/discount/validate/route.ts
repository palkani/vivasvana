import { z } from 'zod';
import { prisma } from '@vivasvana/db';
import { DiscountService } from '@/lib/server/services/discount.service';
import { route, parseBody, json } from '@/lib/server/http';
import { optionalAuth } from '@/lib/server/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ValidateBody = z.object({
  code: z.string().min(2).max(40),
  subtotal: z.coerce.number().min(0),
});

export const POST = route(async (req) => {
  const user = await optionalAuth(req);
  const body = await parseBody(req, ValidateBody);
  const service = new DiscountService(prisma);
  return json(
    await service.validate({
      code: body.code,
      subtotal: body.subtotal,
      userId: user?.id,
    }),
  );
});
