import { z } from 'zod';
import { prisma } from '@vivasvana/db';
import { CartService } from '@/lib/server/services/cart.service';
import { serializeMoney } from '@/lib/server/lib/decimal';
import { route, parseBody, json } from '@/lib/server/http';
import { resolveCartOwner, mapCartServiceError } from '../owner';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const AddItem = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().optional(),
  quantity: z.coerce.number().int().positive().max(99).default(1),
});

export const POST = route(async (req) => {
  const owner = await resolveCartOwner(req);
  const body = await parseBody(req, AddItem);
  const service = new CartService(prisma);
  try {
    const cart = await service.addItem(owner, body);
    return json(serializeMoney(cart), { status: 201 });
  } catch (err) {
    return mapCartServiceError(err);
  }
});
