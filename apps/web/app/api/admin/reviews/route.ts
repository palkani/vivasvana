import { z } from 'zod';
import { prisma } from '@vivasvana/db';
import { ReviewService } from '@/lib/server/services/review.service';
import { route, parseQuery, json } from '@/lib/server/http';
import { requirePermission } from '@/lib/server/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ListQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(50),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
});

export const GET = route(async (req) => {
  await requirePermission(req, 'view_blog');
  const query = parseQuery(req, ListQuery);
  const service = new ReviewService(prisma);
  return json(await service.adminList(query));
});