import { z } from 'zod';
import { prisma } from '@vivasvana/db';
import { ReportsService } from '@/lib/server/services/reports.service';
import { route, parseQuery, json } from '@/lib/server/http';
import { requirePermission } from '@/lib/server/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Query = z.object({ range: z.enum(['30d', '90d', '365d', 'all']).default('30d') });

// Profit/COGS + current inventory value.
export const GET = route(async (req) => {
  await requirePermission(req, 'view_reports');
  const { range } = parseQuery(req, Query);
  const svc = new ReportsService(prisma);
  const [profit, inventory] = await Promise.all([svc.profitSummary(range), svc.inventoryValue()]);
  return json({ profit, inventory });
});
