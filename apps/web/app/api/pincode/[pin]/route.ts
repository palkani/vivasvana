import { z } from 'zod';
import { lookupPincode } from '@/lib/server/integrations/india-post';
import { route, parseParams, notFound, json } from '@/lib/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Params = z.object({ pin: z.string().regex(/^[1-9]\d{5}$/) });

export const GET = route(async (_req, ctx) => {
  const { pin } = await parseParams(ctx, Params);
  const result = await lookupPincode(pin);
  if (!result) throw notFound('PIN not found');
  return json(result);
});
