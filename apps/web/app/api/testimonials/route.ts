import { z } from 'zod';
import { prisma } from '@vivasvana/db';
import { route, parseQuery, json } from '@/lib/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ListQuery = z.object({
  limit: z.coerce.number().int().positive().max(24).default(6),
});

export const GET = route(async (req) => {
  const { limit } = parseQuery(req, ListQuery);
  const items = await prisma.testimonial.findMany({
    where: { status: 'PUBLISHED' },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    take: limit,
  });
  return json({ items });
});
