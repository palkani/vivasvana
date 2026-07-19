import { prisma } from '@vivasvana/db';
import { InventoryService } from '@/lib/server/services/inventory.service';
import { route, json } from '@/lib/server/http';
import { requirePermission } from '@/lib/server/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route(async (req) => {
  await requirePermission(req, 'view_products');
  const service = new InventoryService(prisma);
  return json({ items: await service.listLowStock() });
});