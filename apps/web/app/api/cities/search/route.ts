import { z } from 'zod';
import { searchCitiesByName } from '@/lib/server/integrations/india-post';
import { route, parseQuery, json } from '@/lib/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Query = z.object({ q: z.string().min(2).max(60) });

export const GET = route(async (req) => {
  const { q } = parseQuery(req, Query);
  const hits = await searchCitiesByName(q);
  return json({ items: hits });
});
