import { prisma } from '@vivasvana/db';
import { CartService } from '@/lib/server/services/cart.service';
import { serializeMoney } from '@/lib/server/lib/decimal';
import { route, json } from '@/lib/server/http';
import { resolveCartOwner } from '../owner';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = route(async (req) => {
  const owner = await resolveCartOwner(req);
  const service = new CartService(prisma);
  const cart = await service.getOrCreate(owner);
  const result = await service.clear(cart.id);
  return json(serializeMoney(result));
});
