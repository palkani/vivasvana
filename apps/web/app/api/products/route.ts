import { z } from 'zod';
import { prisma } from '@vivasvana/db';
import { ProductService } from '@/lib/server/services/product.service';
import { serializeMoney } from '@/lib/server/lib/decimal';
import { route, parseQuery, json } from '@/lib/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ListQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(60).default(12),
  sort: z.enum(['newest', 'price-asc', 'price-desc', 'bestseller']).default('newest'),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  isVegan: z.coerce.boolean().optional(),
  isGlutenFree: z.coerce.boolean().optional(),
  category: z.string().optional(),
  search: z.string().optional(),
});

export const GET = route(async (req) => {
  const query = parseQuery(req, ListQuery);
  const service = new ProductService(prisma);
  const result = await service.list({ ...query, status: 'PUBLISHED' });
  return json(serializeMoney(result));
});
