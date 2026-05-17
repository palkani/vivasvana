import type { PrismaClient, Discount } from '@vivasvana/db';
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
}
