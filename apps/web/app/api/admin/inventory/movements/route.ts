import { z } from 'zod';
import { prisma } from '@vivasvana/db';
import { InventoryService } from '@/lib/server/services/inventory.service';
import { route, parseQuery, json } from '@/lib/server/http';
import { requirePermission } from '@/lib/server/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ListQuery = z.object({
  productId: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(50),
});

export const GET = route(async (req) => {
  await requirePermission(req, 'view_products');
  const query = parseQuery(req, ListQuery);
  const service = new InventoryService(prisma);
  return json(await service.movements(query));
});