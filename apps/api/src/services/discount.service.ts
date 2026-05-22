import type {
  PrismaClient,
  Discount,
  DiscountType,
  DiscountApplyTarget,
  CustomerScope,
  DiscountStatus,
} from '@vivasvana/db';
import { Prisma } from '@vivasvana/db';

export interface DiscountValidationContext {
  code: string;
  subtotal: number; // INR major units
  userId?: string;
}

export interface DiscountValidationResult {
  valid: boolean;
  reason?: string;
  discount?: {
    code: string;
    type: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_SHIPPING';
    value: string;
    appliedAmount: string; // INR string, what to subtract from totals
    freeShipping: boolean;
  };
}

const REASONS = {
  INVALID: 'Invalid discount code',
  EXPIRED: 'This code has expired',
  NOT_STARTED: 'This code is not active yet',
  MIN_ORDER: 'Add more items to use this code',
  USAGE_LIMIT: 'This code has reached its usage limit',
  USER_LIMIT: 'You have already used this code',
} as const;

export class DiscountService {
  constructor(private readonly prisma: PrismaClient) {}

  async validate(ctx: DiscountValidationContext): Promise<DiscountValidationResult> {
    const code = ctx.code.trim().toUpperCase();
    const discount = await this.prisma.discount.findUnique({ where: { code } });
    if (!discount) return { valid: false, reason: REASONS.INVALID };
    if (discount.status !== 'ACTIVE') return { valid: false, reason: REASONS.EXPIRED };

    const now = new Date();
    if (discount.validFrom && discount.validFrom > now) {
      return { valid: false, reason: REASONS.NOT_STARTED };
    }
    if (discount.validUntil && discount.validUntil < now) {
      return { valid: false, reason: REASONS.EXPIRED };
    }
    if (discount.minOrderValue && ctx.subtotal < Number(discount.minOrderValue.toString())) {
      const need = (Number(discount.minOrderValue.toString()) - ctx.subtotal).toFixed(2);
      return { valid: false, reason: `Order at least ₹${need} more to use this code` };
    }
    if (discount.maxUses !== null && discount.usedCount >= discount.maxUses) {
      return { valid: false, reason: REASONS.USAGE_LIMIT };
    }
    if (ctx.userId && discount.maxUsesPerUser !== null) {
      const used = await this.prisma.order.count({
        where: {
          userId: ctx.userId,
          discountCode: code,
          paymentStatus: { in: ['PAID', 'AUTHORIZED'] },
        },
      });
      if (used >= discount.maxUsesPerUser) {
        return { valid: false, reason: REASONS.USER_LIMIT };
      }
    }

    const applied = this.computeAppliedAmount(discount, ctx.subtotal);
    return {
      valid: true,
      discount: {
        code: discount.code,
        type: discount.type,
        value: discount.value.toString(),
        appliedAmount: applied,
        freeShipping: discount.type === 'FREE_SHIPPING',
      },
    };
  }

  /** Returns the INR amount to deduct from totals as a "999.99"-style string. */
  private computeAppliedAmount(discount: Discount, subtotal: number): string {
    const value = Number(discount.value.toString());
    if (discount.type === 'FIXED_AMOUNT') {
      return Math.min(value, subtotal).toFixed(2);
    }
    if (discount.type === 'PERCENTAGE') {
      const raw = (subtotal * value) / 100;
      const cap = discount.maxDiscount ? Number(discount.maxDiscount.toString()) : Infinity;
      return Math.min(raw, cap, subtotal).toFixed(2);
    }
    // FREE_SHIPPING contributes 0 to subtotal — shipping line handled separately
    return '0.00';
  }

  /** Increment usedCount on a discount. Call from order-create transaction. */
  async recordUsage(tx: Prisma.TransactionClient, code: string): Promise<void> {
    await tx.discount.update({
      where: { code: code.toUpperCase() },
      data: { usedCount: { increment: 1 } },
    });
  }

  // ============================================================================
  // ADMIN
  // ============================================================================

  async adminList(args: {
    page?: number;
    pageSize?: number;
    status?: DiscountStatus;
    type?: DiscountType;
    search?: string;
    sort?: 'createdAt-desc' | 'createdAt-asc' | 'usedCount-desc' | 'code-asc';
  }) {
    const page = args.page ?? 1;
    const pageSize = args.pageSize ?? 50;
    const where: Prisma.DiscountWhereInput = {};
    if (args.status) where.status = args.status;
    if (args.type) where.type = args.type;
    if (args.search) {
      const q = args.search.trim();
      where.OR = [
        { code: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ];
    }

    const orderBy: Prisma.DiscountOrderByWithRelationInput =
      args.sort === 'createdAt-asc'
        ? { createdAt: 'asc' }
        : args.sort === 'usedCount-desc'
          ? { usedCount: 'desc' }
          : args.sort === 'code-asc'
            ? { code: 'asc' }
            : { createdAt: 'desc' };

    const [items, total] = await Promise.all([
      this.prisma.discount.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.discount.count({ where }),
    ]);

    // Pull a count of *paid* orders that actually used each code — gives admin
    // visibility into real revenue impact vs. raw usedCount (which can include
    // pending/cancelled).
    const codes = items.map((d) => d.code);
    const paidUses = codes.length
      ? await this.prisma.order.groupBy({
          by: ['discountCode'],
          where: {
            discountCode: { in: codes },
            paymentStatus: { in: ['PAID', 'AUTHORIZED'] },
            status: { notIn: ['CANCELLED', 'REFUNDED'] },
          },
          _count: { _all: true },
          _sum: { discount: true },
        })
      : [];
    const byCode = new Map(paidUses.map((p) => [p.discountCode, p]));

    return {
      total,
      page,
      pageSize,
      items: items.map((d) => ({
        ...d,
        stats: {
          paidUses: byCode.get(d.code)?._count?._all ?? 0,
          totalDiscounted: byCode.get(d.code)?._sum?.discount?.toString() ?? '0',
        },
      })),
    };
  }

  async adminGet(id: string) {
    const discount = await this.prisma.discount.findUnique({ where: { id } });
    if (!discount) return null;

    const paid = await this.prisma.order.aggregate({
      where: {
        discountCode: discount.code,
        paymentStatus: { in: ['PAID', 'AUTHORIZED'] },
        status: { notIn: ['CANCELLED', 'REFUNDED'] },
      },
      _count: { _all: true },
      _sum: { discount: true, total: true },
    });

    return {
      ...discount,
      stats: {
        paidUses: paid._count._all,
        totalDiscounted: paid._sum.discount?.toString() ?? '0',
        totalRevenue: paid._sum.total?.toString() ?? '0',
      },
    };
  }

  async adminCreate(input: AdminDiscountInput) {
    const code = input.code.trim().toUpperCase();

    if (input.type !== 'FREE_SHIPPING' && Number(input.value) <= 0) {
      throw new Error('VALUE_REQUIRED');
    }
    if (input.type === 'PERCENTAGE' && Number(input.value) > 100) {
      throw new Error('PERCENT_TOO_HIGH');
    }
    if (input.validFrom && input.validUntil && input.validFrom >= input.validUntil) {
      throw new Error('INVALID_DATE_RANGE');
    }

    const existing = await this.prisma.discount.findUnique({ where: { code } });
    if (existing) throw new Error('CODE_EXISTS');

    return this.prisma.discount.create({
      data: {
        code,
        description: input.description ?? null,
        type: input.type,
        value: new Prisma.Decimal(input.value),
        minOrderValue: input.minOrderValue ? new Prisma.Decimal(input.minOrderValue) : null,
        maxDiscount: input.maxDiscount ? new Prisma.Decimal(input.maxDiscount) : null,
        appliesTo: input.appliesTo ?? 'ALL',
        customerScope: input.customerScope ?? 'ALL',
        maxUses: input.maxUses ?? null,
        maxUsesPerUser: input.maxUsesPerUser ?? null,
        validFrom: input.validFrom ?? null,
        validUntil: input.validUntil ?? null,
        status: input.status ?? 'ACTIVE',
      },
    });
  }

  async adminUpdate(id: string, input: Partial<AdminDiscountInput>) {
    const discount = await this.prisma.discount.findUnique({ where: { id } });
    if (!discount) throw new Error('DISCOUNT_NOT_FOUND');

    if (input.type === 'PERCENTAGE' && input.value && Number(input.value) > 100) {
      throw new Error('PERCENT_TOO_HIGH');
    }
    if (input.validFrom && input.validUntil && input.validFrom >= input.validUntil) {
      throw new Error('INVALID_DATE_RANGE');
    }

    // Code can be changed but must remain unique. Always normalize to uppercase.
    let nextCode = discount.code;
    if (input.code && input.code.trim().toUpperCase() !== discount.code) {
      nextCode = input.code.trim().toUpperCase();
      const clash = await this.prisma.discount.findUnique({ where: { code: nextCode } });
      if (clash) throw new Error('CODE_EXISTS');
    }

    return this.prisma.discount.update({
      where: { id },
      data: {
        code: nextCode,
        description: input.description === undefined ? undefined : input.description,
        type: input.type,
        value: input.value !== undefined ? new Prisma.Decimal(input.value) : undefined,
        minOrderValue:
          input.minOrderValue === undefined
            ? undefined
            : input.minOrderValue === null
              ? null
              : new Prisma.Decimal(input.minOrderValue),
        maxDiscount:
          input.maxDiscount === undefined
            ? undefined
            : input.maxDiscount === null
              ? null
              : new Prisma.Decimal(input.maxDiscount),
        appliesTo: input.appliesTo,
        customerScope: input.customerScope,
        maxUses: input.maxUses === undefined ? undefined : input.maxUses,
        maxUsesPerUser: input.maxUsesPerUser === undefined ? undefined : input.maxUsesPerUser,
        validFrom: input.validFrom === undefined ? undefined : input.validFrom,
        validUntil: input.validUntil === undefined ? undefined : input.validUntil,
        status: input.status,
      },
    });
  }

  async adminArchive(id: string) {
    const discount = await this.prisma.discount.findUnique({ where: { id } });
    if (!discount) throw new Error('DISCOUNT_NOT_FOUND');
    return this.prisma.discount.update({
      where: { id },
      data: { status: 'DISABLED' },
    });
  }

  async adminActivate(id: string) {
    const discount = await this.prisma.discount.findUnique({ where: { id } });
    if (!discount) throw new Error('DISCOUNT_NOT_FOUND');
    return this.prisma.discount.update({
      where: { id },
      data: { status: 'ACTIVE' },
    });
  }

  async adminDelete(id: string) {
    const discount = await this.prisma.discount.findUnique({ where: { id } });
    if (!discount) throw new Error('DISCOUNT_NOT_FOUND');
    if (discount.usedCount > 0) throw new Error('IN_USE');
    await this.prisma.discount.delete({ where: { id } });
  }
}

export interface AdminDiscountInput {
  code: string;
  description?: string | null;
  type: DiscountType;
  value: string;
  minOrderValue?: string | null;
  maxDiscount?: string | null;
  appliesTo?: DiscountApplyTarget;
  customerScope?: CustomerScope;
  maxUses?: number | null;
  maxUsesPerUser?: number | null;
  validFrom?: Date | null;
  validUntil?: Date | null;
  status?: DiscountStatus;
}
