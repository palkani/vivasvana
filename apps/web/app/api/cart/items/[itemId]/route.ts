import { z } from 'zod';
import { prisma } from '@vivasvana/db';
import { CartService } from '@/lib/server/services/cart.service';
import { serializeMoney } from '@/lib/server/lib/decimal';
import { route, parseBody, parseParams, json } from '@/lib/server/http';
import { resolveCartOwner, mapCartServiceError } from '../../owner';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Params = z.object({ itemId: z.string().uuid() });
const UpdateItem = z.object({
  quantity: z.coerce.number().int().min(0).max(99),
});

export const PUT = route(async (req, ctx) => {
  const { itemId } = await parseParams(ctx, Params);
  const body = await parseBody(req, UpdateItem);
  const owner = await resolveCartOwner(req);
  const service = new CartService(prisma);
  const cart = await service.getOrCreate(owner);
  try {
    const result = await service.updateItem(cart.id, itemId, body.quantity);
    return json(serializeMoney(result));
  } catch (err) {
    return mapCartServiceError(err);
  }
});

export const DELETE = route(async (req, ctx) => {
  const { itemId } = await parseParams(ctx, Params);
  const owner = await resolveCartOwner(req);
  const service = new CartService(prisma);
  const cart = await service.getOrCreate(owner);
  try {
    const result = await service.removeItem(cart.id, itemId);
    return json(serializeMoney(result));
  } catch (err) {
    return mapCartServiceError(err);
  }
});
