import type { PrismaClient } from '@vivasvana/db';

/**
 * Sales reporting aggregates. Raw SQL because Prisma's groupBy doesn't
 * easily join across order_items → orders or order_shipping → orders, and
 * we want one round-trip per report.
 *
 * Revenue accounting: only orders whose status is in the "money will come"
 * set count — CONFIRMED / PACKED / SHIPPED / DELIVERED. We deliberately
 * include CONFIRMED COD orders because their payment_status is PENDING
 * until delivery; filtering by payment_status='PAID' would understate
 * Indian-market revenue dramatically.
 */

export type ReportRange = '30d' | '90d' | '365d' | 'all';

const REVENUE_STATUSES = ['CONFIRMED', 'PACKED', 'SHIPPED', 'DELIVERED'] as const;

function startDateFor(range: ReportRange): Date | null {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  switch (range) {
    case '30d':
      return new Date(now - 30 * day);
    case '90d':
      return new Date(now - 90 * day);
    case '365d':
      return new Date(now - 365 * day);
    case 'all':
      return null;
  }
}

export interface ProductSalesRow {
  productId: string | null;
  title: string;
  sku: string;
  quantitySold: number;
  revenue: string;
  orderCount: number;
}

export interface StateSalesRow {
  state: string;
  orderCount: number;
  revenue: string;
  uniqueCustomers: number;
}

export interface SalesSummary {
  totalOrders: number;
  totalRevenue: string;
  averageOrderValue: string;
  totalItemsSold: number;
}

export class ReportsService {
  constructor(private readonly prisma: PrismaClient) {}

  async productSales(range: ReportRange = '30d'): Promise<ProductSalesRow[]> {
    const start = startDateFor(range);
    const rows = await this.prisma.$queryRaw<
      Array<{
        product_id: string | null;
        title: string;
        sku: string;
        quantity_sold: bigint;
        revenue: string;
        order_count: bigint;
      }>
    >`
      SELECT
        oi.product_id,
        oi.title,
        oi.sku,
        SUM(oi.quantity)::bigint AS quantity_sold,
        SUM(oi.total)::text      AS revenue,
        COUNT(DISTINCT oi.order_id)::bigint AS order_count
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE o.status::text = ANY (${REVENUE_STATUSES as unknown as string[]}::text[])
        AND (${start}::timestamptz IS NULL OR o.placed_at >= ${start}::timestamptz)
      GROUP BY oi.product_id, oi.title, oi.sku
      ORDER BY SUM(oi.total) DESC
      LIMIT 50;
    `;

    return rows.map((r) => ({
      productId: r.product_id,
      title: r.title,
      sku: r.sku,
      quantitySold: Number(r.quantity_sold),
      revenue: r.revenue,
      orderCount: Number(r.order_count),
    }));
  }

  async stateSales(range: ReportRange = '30d'): Promise<StateSalesRow[]> {
    const start = startDateFor(range);
    const rows = await this.prisma.$queryRaw<
      Array<{
        state: string;
        order_count: bigint;
        revenue: string;
        unique_customers: bigint;
      }>
    >`
      SELECT
        os.state,
        COUNT(DISTINCT o.id)::bigint     AS order_count,
        SUM(o.total)::text               AS revenue,
        COUNT(DISTINCT COALESCE(o.user_id::text, o.email))::bigint AS unique_customers
      FROM order_shipping os
      JOIN orders o ON o.id = os.order_id
      WHERE o.status::text = ANY (${REVENUE_STATUSES as unknown as string[]}::text[])
        AND (${start}::timestamptz IS NULL OR o.placed_at >= ${start}::timestamptz)
      GROUP BY os.state
      ORDER BY SUM(o.total) DESC;
    `;

    return rows.map((r) => ({
      state: r.state,
      orderCount: Number(r.order_count),
      revenue: r.revenue,
      uniqueCustomers: Number(r.unique_customers),
    }));
  }

  async summary(range: ReportRange = '30d'): Promise<SalesSummary> {
    const start = startDateFor(range);
    const rows = await this.prisma.$queryRaw<
      Array<{
        total_orders: bigint;
        total_revenue: string | null;
        total_items: bigint | null;
      }>
    >`
      SELECT
        COUNT(DISTINCT o.id)::bigint AS total_orders,
        SUM(o.total)::text           AS total_revenue,
        (
          SELECT SUM(oi.quantity)::bigint
          FROM order_items oi
          JOIN orders o2 ON o2.id = oi.order_id
          WHERE o2.status::text = ANY (${REVENUE_STATUSES as unknown as string[]}::text[])
            AND (${start}::timestamptz IS NULL OR o2.placed_at >= ${start}::timestamptz)
        ) AS total_items
      FROM orders o
      WHERE o.status::text = ANY (${REVENUE_STATUSES as unknown as string[]}::text[])
        AND (${start}::timestamptz IS NULL OR o.placed_at >= ${start}::timestamptz);
    `;

    const r = rows[0];
    const orders = Number(r?.total_orders ?? 0);
    const revenue = r?.total_revenue ?? '0';
    const items = Number(r?.total_items ?? 0);
    const aov = orders > 0 ? (Number(revenue) / orders).toFixed(2) : '0.00';

    return {
      totalOrders: orders,
      totalRevenue: revenue ?? '0',
      averageOrderValue: aov,
      totalItemsSold: items,
    };
  }
}
