import type { PrismaClient } from '@vivasvana/db';
import { Prisma } from '@vivasvana/db';

/**
 * Customer = User row with role CUSTOMER, enriched with order aggregates.
 * Staff/admin accounts are excluded from these listings.
 */
export class CustomerService {
  constructor(private readonly prisma: PrismaClient) {}

  async adminList(args: {
    page?: number;
    pageSize?: number;
    search?: string;
    sort?: 'createdAt-desc' | 'createdAt-asc' | 'spend-desc' | 'orders-desc' | 'name-asc';
    hasOrders?: boolean;
  }) {
    const page = args.page ?? 1;
    const pageSize = args.pageSize ?? 25;

    const where: Prisma.UserWhereInput = {
      role: 'CUSTOMER',
      deletedAt: null,
    };
    if (args.search) {
      const q = args.search.trim();
      where.OR = [
        { email: { contains: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q } },
      ];
    }
    if (args.hasOrders) {
      where.orders = { some: {} };
    }

    // For spend/orders sorts we need to fetch all matching ids first and sort
    // in JS — Prisma can't `orderBy` on a relation aggregate directly without
    // raw SQL. For default time-based sorts we go straight to the DB.
    const needsClientSort = args.sort === 'spend-desc' || args.sort === 'orders-desc';

    const orderBy: Prisma.UserOrderByWithRelationInput =
      args.sort === 'createdAt-asc'
        ? { createdAt: 'asc' }
        : args.sort === 'name-asc'
          ? { name: 'asc' }
          : { createdAt: 'desc' };

    const total = await this.prisma.user.count({ where });

    const users = needsClientSort
      ? await this.prisma.user.findMany({ where, orderBy: { createdAt: 'desc' } })
      : await this.prisma.user.findMany({
          where,
          orderBy,
          skip: (page - 1) * pageSize,
          take: pageSize,
        });

    // One groupBy across the page (or whole set if client-sorting) is much
    // cheaper than N per-user queries.
    const userIds = users.map((u) => u.id);
    const stats = userIds.length
      ? await this.prisma.order.groupBy({
          by: ['userId'],
          where: {
            userId: { in: userIds },
            // Lifetime value should only count revenue we actually keep.
            paymentStatus: { in: ['PAID', 'AUTHORIZED'] },
            status: { notIn: ['CANCELLED', 'REFUNDED', 'RETURNED'] },
          },
          _count: { _all: true },
          _sum: { total: true },
          _max: { placedAt: true },
        })
      : [];
    const totalOrders = userIds.length
      ? await this.prisma.order.groupBy({
          by: ['userId'],
          where: { userId: { in: userIds } },
          _count: { _all: true },
        })
      : [];

    const statsByUser = new Map(stats.map((s) => [s.userId!, s]));
    const ordersByUser = new Map(totalOrders.map((s) => [s.userId!, s._count._all]));

    let enriched = users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      phone: u.phone,
      gstin: u.gstin,
      createdAt: u.createdAt,
      stats: {
        totalOrders: ordersByUser.get(u.id) ?? 0,
        paidOrders: statsByUser.get(u.id)?._count?._all ?? 0,
        lifetimeValue: statsByUser.get(u.id)?._sum?.total?.toString() ?? '0',
        lastOrderAt: statsByUser.get(u.id)?._max?.placedAt ?? null,
      },
    }));

    if (needsClientSort) {
      if (args.sort === 'spend-desc') {
        enriched.sort((a, b) => Number(b.stats.lifetimeValue) - Number(a.stats.lifetimeValue));
      } else {
        enriched.sort((a, b) => b.stats.totalOrders - a.stats.totalOrders);
      }
      // Apply pagination after client-side sort.
      enriched = enriched.slice((page - 1) * pageSize, page * pageSize);
    }

    return { total, page, pageSize, items: enriched };
  }

  async adminGet(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        addresses: { orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }] },
        orders: {
          orderBy: { placedAt: 'desc' },
          take: 50,
          select: {
            id: true,
            orderNumber: true,
            status: true,
            paymentStatus: true,
            paymentMethod: true,
            total: true,
            currency: true,
            placedAt: true,
            shippingAddress: { select: { city: true, state: true } },
            _count: { select: { items: true } },
          },
        },
      },
    });
    if (!user || user.deletedAt) return null;

    // Lifetime stats across PAID, non-cancelled orders.
    const paid = await this.prisma.order.aggregate({
      where: {
        userId,
        paymentStatus: { in: ['PAID', 'AUTHORIZED'] },
        status: { notIn: ['CANCELLED', 'REFUNDED', 'RETURNED'] },
      },
      _count: { _all: true },
      _sum: { total: true },
    });
    const all = await this.prisma.order.count({ where: { userId } });

    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      name: user.name,
      role: user.role,
      gstin: user.gstin,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      addresses: user.addresses,
      orders: user.orders,
      stats: {
        totalOrders: all,
        paidOrders: paid._count._all,
        lifetimeValue: paid._sum.total?.toString() ?? '0',
      },
    };
  }
}
