import { z } from 'zod';
import { prisma } from '@vivasvana/db';
import { CartService } from '@/lib/server/services/cart.service';
import { serializeMoney } from '@/lib/server/lib/decimal';
import { route, parseBody, json } from '@/lib/server/http';
import { requireAuth } from '@/lib/server/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MergeBody = z.object({ sessionId: z.string().uuid() });

export const POST = route(async (req) => {
  const user = await requireAuth(req);
  const body = await parseBody(req, MergeBody);
  const service = new CartService(prisma);
  const merged = await service.mergeGuestIntoUser({
    userId: user.id,
    sessionId: body.sessionId,
  });
  return json(serializeMoney(merged));
});
