import { z } from 'zod';
import { prisma } from '@vivasvana/db';
import { OrderService } from '@/lib/server/services/order.service';
import { serializeMoney } from '@/lib/server/lib/decimal';
import { route, parseQuery, json } from '@/lib/server/http';
import { requirePermission } from '@/lib/server/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ListQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  status: z
    .enum(['PENDING', 'CONFIRMED', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED', 'REFUNDED'])
    .optional(),
  paymentStatus: z
    .enum(['PENDING', 'AUTHORIZED', 'PAID', 'FAILED', 'REFUNDED', 'PARTIAL_REFUNDED'])
    .optional(),
  paymentMethod: z.enum(['RAZORPAY', 'COD', 'STRIPE']).optional(),
  search: z.string().min(1).max(120).optional(),
  placedFrom: z.coerce.date().optional(),
  placedTo: z.coerce.date().optional(),
  sort: z.enum(['placedAt-desc', 'placedAt-asc', 'total-desc', 'total-asc']).default('placedAt-desc'),
});

// List orders with filters, search and pagination — read scope.
export const GET = route(async (req) => {
  await requirePermission(req, 'view_orders');
  const query = parseQuery(req, ListQuery);
  const orders = new OrderService(prisma);
  return json(serializeMoney(await orders.adminList(query)));
});
