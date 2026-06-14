import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { ReportsService, type ReportRange } from '../../services/reports.service.js';

const RangeQuery = z.object({
  range: z.enum(['30d', '90d', '365d', 'all']).default('30d'),
});

const adminReportsRoutes: FastifyPluginAsyncZod = async (app) => {
  const service = new ReportsService(app.prisma);

  app.register(async (admin: typeof app) => {
    admin.addHook('preHandler', admin.requirePermission('view_reports'));

    admin.get(
      '/api/admin/reports/summary',
      {
        schema: {
          tags: ['admin', 'reports'],
          summary: 'Top-line KPIs (orders, revenue, AOV, items) over a range',
          querystring: RangeQuery,
          security: [{ bearerAuth: [] }],
        },
      },
      async (req) => service.summary(req.query.range as ReportRange),
    );

    admin.get(
      '/api/admin/reports/sales-by-product',
      {
        schema: {
          tags: ['admin', 'reports'],
          summary: 'Top products by revenue (top 50)',
          querystring: RangeQuery,
          security: [{ bearerAuth: [] }],
        },
      },
      async (req) => ({ items: await service.productSales(req.query.range as ReportRange) }),
    );

    admin.get(
      '/api/admin/reports/sales-by-state',
      {
        schema: {
          tags: ['admin', 'reports'],
          summary: 'Sales aggregated by shipping state',
          querystring: RangeQuery,
          security: [{ bearerAuth: [] }],
        },
      },
      async (req) => ({ items: await service.stateSales(req.query.range as ReportRange) }),
    );
  });
};

export default adminReportsRoutes;

