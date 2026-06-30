import { z } from 'zod';
import { prisma } from '@vivasvana/db';
import { AddressService } from '@/lib/server/services/address.service';
import { route, parseBody, parseParams, notFound, json } from '@/lib/server/http';
import { requireAuth } from '@/lib/server/auth';
import { AddressBody } from '../route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Params = z.object({ id: z.string().uuid() });

export const PUT = route(async (req, ctx) => {
  const user = await requireAuth(req);
  const { id } = await parseParams(ctx, Params);
  const body = await parseBody(req, AddressBody.partial());
  const service = new AddressService(prisma);
  try {
    return json(await service.update(user.id, id, body));
  } catch (err) {
    if (err instanceof Error && err.message === 'ADDRESS_NOT_FOUND') {
      throw notFound('Address not found');
    }
    throw err;
  }
});

export const DELETE = route(async (req, ctx) => {
  const user = await requireAuth(req);
  const { id } = await parseParams(ctx, Params);
  const service = new AddressService(prisma);
  try {
    await service.delete(user.id, id);
    return new Response(null, { status: 204 });
  } catch (err) {
    if (err instanceof Error && err.message === 'ADDRESS_NOT_FOUND') {
      throw notFound('Address not found');
    }
    throw err;
  }
});
