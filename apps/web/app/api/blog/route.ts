import { z } from 'zod';
import { prisma } from '@vivasvana/db';
import { BlogService } from '@/lib/server/services/blog.service';
import { route, parseQuery, json } from '@/lib/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ListQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(50).default(12),
  search: z.string().min(1).max(120).optional(),
});

export const GET = route(async (req) => {
  const query = parseQuery(req, ListQuery);
  const service = new BlogService(prisma);
  return json(await service.publicList(query));
});
