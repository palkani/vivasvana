import type { PrismaClient, Prisma } from '@vivasvana/db';
import { DiscountService } from './discount.service.js';
import { OrderNumberService } from './order-number.service.js';

export interface CreateOrderInput {
  userId?: string;
  sessionId?: string;
  email: string;
  phone: string;
  paymentMethod: 'RAZORPAY' | 'COD' | 'STRIPE';
  shipping: {
    name: string;
    phone: string;
    addressLine: string;
    landmark?: string;
    city: string;
    state: string;
    pincode: string;
    country?: string;
  };
  discountCode?: string;
  gstin?: string;
  companyName?: string;
  notes?: string;
}

export class OrderService {
  private readonly discounts: DiscountService;
  private readonly orderNumbers = new OrderNumberService();

  constructor(private readonly prisma: PrismaClient) {
    this.discounts = new DiscountService(prisma);
  }

  /**
   * Build an order from the active cart for this owner. The order starts in
   * PENDING status (payment not yet captured). Payment confirmation happens
   * in a separate step via PaymentService.confirm() / mock-confirm.
   *
   * Stock decrement here is provisional — items are reserved as the order is
   * created. If payment fails, OrderService.cancel() restores the stock.
   * For Phase 2 + mock payments this is fine; real Razorpay flow in Phase 3
   * will tighten the reservation window with TTL.
   */
  async createFromCart(input: CreateOrderInput) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Load cart for this owner
      const cart = await tx.cart.findFirst({
        where: input.userId
          ? { userId: input.userId }
          : { sessionId: input.sessionId ?? '', userId: null },
        include: {
          items: { include: { product: true, variant: true } },
        },
      });
      if (!cart || cart.items.length === 0) throw new Error('EMPTY_CART');

      // 2. Validate stock & freshness; re-snapshot prices from current product
      const items: Array<{
        productId: string;
        variantId: string | null;
        title: string;
        sku: string;
        hsnCode: string;
        quantity: number;
        unitPrice: Prisma.Decimal | string;
        taxRate: Prisma.Decimal | string;
        lineTotal: number;
      }> = [];

      for (const ci of cart.items) {
        if (!ci.product || ci.product.deletedAt || ci.product.status !== 'PUBLISHED') {
          throw new Error(`PRODUCT_UNAVAILABLE:${ci.productId}`);
        }
        const stock = ci.variant?.stock ?? ci.product.stock;
        if (ci.quantity > stock) throw new Error(`INSUFFICIENT_STOCK:${ci.productId}`);
        const unitPrice =
          ci.variant?.salePrice ?? ci.variant?.price ?? ci.product.salePrice ?? ci.product.price;
        items.push({
          productId: ci.productId,
          variantId: ci.variantId,
          title: ci.product.title,
          sku: ci.variant?.sku ?? ci.product.sku,
          hsnCode: ci.product.hsnCode,
          quantity: ci.quantity,
          unitPrice,
          taxRate: ci.product.taxRate,
          lineTotal: Number(unitPrice.toString()) * ci.quantity,
        });
      }

      // 3. Totals
      const subtotal = items.reduce((acc, it) => acc + it.lineTotal, 0);
      let discountAmount = 0;
      let freeShipping = false;
      if (input.discountCode) {
        const v = await this.discounts.validate({
          code: input.discountCode,
          subtotal,
          userId: input.userId,
        });
        if (!v.valid || !v.discount) throw new Error(`DISCOUNT_INVALID:${v.reason ?? ''}`);
        discountAmount = Number(v.discount.appliedAmount);
        freeShipping = v.discount.freeShipping;
      }

      const baseShipping = subtotal - discountAmount >= 400 || subtotal === 0 ? 0 : 50;
      const shippingCost = freeShipping ? 0 : baseShipping;
      const codFee = input.paymentMethod === 'COD' ? 50 : 0;
      // Tax is included in product prices (Indian GST common practice).
      // We surface the GST portion on invoices but don't add it to total.
      const tax = items.reduce(
        (acc, it) => acc + (it.lineTotal * Number(it.taxRate.toString())) / (100 + Number(it.taxRate.toString())),
        0,
      );
      const total = subtotal - discountAmount + shippingCost + codFee;
      if (total < 0) throw new Error('NEGATIVE_TOTAL');

      // 4. Mint order number
      const orderNumber = await this.orderNumbers.next(tx);

      // 5. Create order + items + shipping snapshot
      const order = await tx.order.create({
        data: {
          orderNumber,
          userId: input.userId ?? null,
          email: input.email,
          phone: input.phone,
          status: 'PENDING',
          paymentStatus: 'PENDING',
          paymentMethod: input.paymentMethod,
          subtotal: subtotal.toFixed(2),
          shipping: shippingCost.toFixed(2),
          discount: discountAmount.toFixed(2),
          tax: tax.toFixed(2),
          codFee: codFee.toFixed(2),
          total: total.toFixed(2),
          currency: 'INR',
          discountCode: input.discountCode?.toUpperCase(),
          gstin: input.gstin,
          companyName: input.companyName,
          notes: input.notes,
          items: {
            create: items.map((it) => ({
              productId: it.productId,
              variantId: it.variantId,
              title: it.title,
              sku: it.sku,
              hsnCode: it.hsnCode,
              quantity: it.quantity,
              price: typeof it.unitPrice === 'string' ? it.unitPrice : it.unitPrice.toString(),
              taxRate: typeof it.taxRate === 'string' ? it.taxRate : it.taxRate.toString(),
              total: it.lineTotal.toFixed(2),
            })),
          },
          shippingAddress: {
            create: {
              name: input.shipping.name,
              phone: input.shipping.phone,
              addressLine: input.shipping.addressLine,
              landmark: input.shipping.landmark,
              city: input.shipping.city,
              state: input.shipping.state,
              pincode: input.shipping.pincode,
              country: input.shipping.country ?? 'IN',
            },
          },
        },
        include: { items: true, shippingAddress: true },
      });

      // 6. Provisionally decrement stock & log movement
      for (const it of items) {
        if (it.variantId) {
          await tx.productVariant.update({
            where: { id: it.variantId },
            data: { stock: { decrement: it.quantity } },
          });
        } else {
          await tx.product.update({
            where: { id: it.productId },
            data: { stock: { decrement: it.quantity } },
          });
        }
        await tx.stockMovement.create({
          data: {
            productId: it.productId,
            variantId: it.variantId,
            delta: -it.quantity,
            reason: 'SALE',
            reference: order.orderNumber,
          },
        });
      }

      // 7. Claim discount usage (atomic; covers race against the per-user cap)
      if (input.discountCode) {
        await this.discounts.recordUsage(tx, input.discountCode);
      }

      // 8. Empty the cart so a reload doesn't duplicate the order
      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

      return order;
    });
  }

  async getForUser(orderId: string, userId: string) {
    return this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: { items: true, shippingAddress: true, payments: true },
    });
  }

  /** Public lookup for the confirmation page — keyed on order number + email. */
  async getPublic(orderNumber: string, email: string) {
    return this.prisma.order.findFirst({
      where: { orderNumber, email },
      include: { items: true, shippingAddress: true, payments: true },
    });
  }

  async listForUser(userId: string, page = 1, pageSize = 20) {
    const [total, items] = await this.prisma.$transaction([
      this.prisma.order.count({ where: { userId } }),
      this.prisma.order.findMany({
        where: { userId },
        orderBy: { placedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          items: { select: { id: true, title: true, quantity: true, price: true, total: true } },
        },
      }),
    ]);
    return { total, items, page, pageSize };
  }

  /** Cancel a still-PENDING order and restore its provisional stock. */
  async cancelPending(orderId: string) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { items: true },
      });
      if (!order) throw new Error('ORDER_NOT_FOUND');
      if (order.status !== 'PENDING') throw new Error('ORDER_NOT_PENDING');

      for (const it of order.items) {
        if (it.variantId) {
          await tx.productVariant.update({
            where: { id: it.variantId },
            data: { stock: { increment: it.quantity } },
          });
        } else if (it.productId) {
          await tx.product.update({
            where: { id: it.productId },
            data: { stock: { increment: it.quantity } },
          });
        }
        await tx.stockMovement.create({
          data: {
            productId: it.productId!,
            variantId: it.variantId,
            delta: it.quantity,
            reason: 'RETURN',
            reference: `${order.orderNumber}:cancel`,
          },
        });
      }

      return tx.order.update({
        where: { id: order.id },
        data: { status: 'CANCELLED', cancelledAt: new Date() },
      });
    });
  }

  // ===========================================================================
  // ADMIN OPERATIONS
  // ===========================================================================

  async adminList(args: {
    page?: number;
    pageSize?: number;
    status?: import('@vivasvana/db').OrderStatus;
    paymentStatus?: import('@vivasvana/db').PaymentStatus;
    paymentMethod?: import('@vivasvana/db').PaymentMethod;
    search?: string;
    placedFrom?: Date;
    placedTo?: Date;
    sort?: 'placedAt-desc' | 'placedAt-asc' | 'total-desc' | 'total-asc';
  }) {
    const page = Math.max(1, args.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, args.pageSize ?? 20));

    const where: import('@vivasvana/db').Prisma.OrderWhereInput = {};
    if (args.status) where.status = args.status;
    if (args.paymentStatus) where.paymentStatus = args.paymentStatus;
    if (args.paymentMethod) where.paymentMethod = args.paymentMethod;
    if (args.placedFrom || args.placedTo) {
      where.placedAt = {};
      if (args.placedFrom) where.placedAt.gte = args.placedFrom;
      if (args.placedTo) where.placedAt.lte = args.placedTo;
    }
    if (args.search) {
      const q = args.search.trim();
      where.OR = [
        { orderNumber: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q } },
        { shippingAddress: { is: { trackingNumber: { contains: q, mode: 'insensitive' } } } },
        { shippingAddress: { is: { name: { contains: q, mode: 'insensitive' } } } },
      ];
    }

    const orderBy: import('@vivasvana/db').Prisma.OrderOrderByWithRelationInput = (() => {
      switch (args.sort) {
        case 'placedAt-asc':
          return { placedAt: 'asc' as const };
        case 'total-desc':
          return { total: 'desc' as const };
        case 'total-asc':
          return { total: 'asc' as const };
        case 'placedAt-desc':
        default:
          return { placedAt: 'desc' as const };
      }
    })();

    const [total, items] = await this.prisma.$transaction([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          items: { select: { id: true, title: true, quantity: true } },
          shippingAddress: { select: { name: true, city: true, state: true, trackingNumber: true, carrier: true } },
        },
      }),
    ]);

    return { total, items, page, pageSize };
  }

  async adminGet(orderId: string) {
    return this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        shippingAddress: true,
        payments: { orderBy: { createdAt: 'desc' } },
        user: { select: { id: true, email: true, name: true, role: true, createdAt: true } },
      },
    });
  }

  /**
   * Manual status transitions for admins. Each transition records the
   * timestamp on the order and is restricted to a valid source state.
   *
   * Allowed transitions:
   *   PENDING        → CONFIRMED | CANCELLED
   *   CONFIRMED      → PACKED    | CANCELLED
   *   PACKED         → SHIPPED   (requires tracking) | CANCELLED
   *   SHIPPED        → DELIVERED | RETURNED
   *   DELIVERED      → RETURNED  | REFUNDED
   *   CANCELLED      → (terminal)
   *   RETURNED       → REFUNDED  (terminal)
   *   REFUNDED       → (terminal)
   */
  async adminConfirm(orderId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new Error('ORDER_NOT_FOUND');
    if (order.status !== 'PENDING') throw new Error('INVALID_TRANSITION');
    return this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'CONFIRMED', confirmedAt: new Date() },
      include: { items: true, shippingAddress: true, payments: true },
    });
  }

  async adminMarkPacked(orderId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new Error('ORDER_NOT_FOUND');
    if (order.status !== 'CONFIRMED') throw new Error('INVALID_TRANSITION');
    return this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'PACKED', packedAt: new Date() },
      include: { items: true, shippingAddress: true, payments: true },
    });
  }

  /**
   * Ship the order: persists carrier + tracking number on order_shipping
   * and flips status to SHIPPED with shippedAt timestamp. Required from
   * PACKED state only (admins must explicitly mark packed first so we
   * don't accidentally ship un-packed orders).
   */
  async adminShip(
    orderId: string,
    args: { carrier: string; trackingNumber: string; trackingUrl?: string },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { shippingAddress: true },
      });
      if (!order) throw new Error('ORDER_NOT_FOUND');
      if (order.status !== 'PACKED') throw new Error('INVALID_TRANSITION');
      if (!order.shippingAddress) throw new Error('MISSING_SHIPPING_ADDRESS');

      const now = new Date();
      await tx.orderShipping.update({
        where: { orderId },
        data: {
          carrier: args.carrier.trim(),
          trackingNumber: args.trackingNumber.trim(),
          trackingUrl: args.trackingUrl?.trim() || null,
          shippedAt: now,
        },
      });
      return tx.order.update({
        where: { id: orderId },
        data: { status: 'SHIPPED', shippedAt: now },
        include: { items: true, shippingAddress: true, payments: true },
      });
    });
  }

  /** Update tracking number on an already-SHIPPED order (typo fixes). */
  async adminUpdateTracking(
    orderId: string,
    args: { carrier?: string; trackingNumber?: string; trackingUrl?: string },
  ) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new Error('ORDER_NOT_FOUND');
    if (order.status !== 'SHIPPED' && order.status !== 'DELIVERED') {
      throw new Error('INVALID_TRANSITION');
    }
    await this.prisma.orderShipping.update({
      where: { orderId },
      data: {
        ...(args.carrier !== undefined ? { carrier: args.carrier.trim() } : {}),
        ...(args.trackingNumber !== undefined
          ? { trackingNumber: args.trackingNumber.trim() }
          : {}),
        ...(args.trackingUrl !== undefined
          ? { trackingUrl: args.trackingUrl?.trim() || null }
          : {}),
      },
    });
    return this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true, shippingAddress: true, payments: true },
    });
  }

  async adminMarkDelivered(orderId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new Error('ORDER_NOT_FOUND');
    if (order.status !== 'SHIPPED') throw new Error('INVALID_TRANSITION');

    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      await tx.orderShipping.update({ where: { orderId }, data: { deliveredAt: now } });
      // COD payment is collected on delivery — mark the pending payment as PAID
      // so the books reflect cash received.
      if (order.paymentMethod === 'COD') {
        await tx.payment.updateMany({
          where: { orderId, status: 'PENDING', gateway: 'COD' },
          data: { status: 'PAID' },
        });
        await tx.order.update({
          where: { id: orderId },
          data: { paymentStatus: 'PAID' },
        });
      }
      return tx.order.update({
        where: { id: orderId },
        data: { status: 'DELIVERED', deliveredAt: now },
        include: { items: true, shippingAddress: true, payments: true },
      });
    });
  }

  /**
   * Admin cancel — works from PENDING / CONFIRMED / PACKED. Restocks
   * inventory and rolls back discount usage. After SHIPPED, use return
   * + refund flow instead (don't restock from a shipped order — the
   * goods are gone until they're returned).
   */
  async adminCancel(orderId: string, reason?: string) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { items: true },
      });
      if (!order) throw new Error('ORDER_NOT_FOUND');
      if (!['PENDING', 'CONFIRMED', 'PACKED'].includes(order.status)) {
        throw new Error('INVALID_TRANSITION');
      }

      // Restore stock
      for (const it of order.items) {
        if (it.variantId) {
          await tx.productVariant.update({
            where: { id: it.variantId },
            data: { stock: { increment: it.quantity } },
          });
        } else if (it.productId) {
          await tx.product.update({
            where: { id: it.productId },
            data: { stock: { increment: it.quantity } },
          });
        }
        await tx.stockMovement.create({
          data: {
            productId: it.productId!,
            variantId: it.variantId,
            delta: it.quantity,
            reason: 'RETURN',
            reference: `${order.orderNumber}:admin-cancel${reason ? `:${reason}` : ''}`,
          },
        });
      }

      // Roll back the discount usage if any
      if (order.discountCode) {
        await tx.discount.updateMany({
          where: { code: order.discountCode, usedCount: { gt: 0 } },
          data: { usedCount: { decrement: 1 } },
        });
      }

      return tx.order.update({
        where: { id: orderId },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          notes: reason ? `${order.notes ?? ''}\n[Cancel reason]: ${reason}`.trim() : order.notes,
        },
        include: { items: true, shippingAddress: true, payments: true },
      });
    });
  }

  /**
   * Mark as RETURNED + restock. Use after a SHIPPED/DELIVERED order
   * comes back. The refund itself is a separate payment-side step.
   */
  async adminMarkReturned(orderId: string, reason?: string) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { items: true },
      });
      if (!order) throw new Error('ORDER_NOT_FOUND');
      if (!['SHIPPED', 'DELIVERED'].includes(order.status)) {
        throw new Error('INVALID_TRANSITION');
      }

      for (const it of order.items) {
        if (it.variantId) {
          await tx.productVariant.update({
            where: { id: it.variantId },
            data: { stock: { increment: it.quantity } },
          });
        } else if (it.productId) {
          await tx.product.update({
            where: { id: it.productId },
            data: { stock: { increment: it.quantity } },
          });
        }
        await tx.stockMovement.create({
          data: {
            productId: it.productId!,
            variantId: it.variantId,
            delta: it.quantity,
            reason: 'RETURN',
            reference: `${order.orderNumber}:return${reason ? `:${reason}` : ''}`,
          },
        });
      }

      return tx.order.update({
        where: { id: orderId },
        data: {
          status: 'RETURNED',
          notes: reason ? `${order.notes ?? ''}\n[Return reason]: ${reason}`.trim() : order.notes,
        },
        include: { items: true, shippingAddress: true, payments: true },
      });
    });
  }

  /**
   * Record a refund. Phase 3 will wire this to the Razorpay refund API;
   * for now this is a bookkeeping operation that flips payment_status
   * and inserts a Payment row of status REFUNDED.
   */
  async adminRefund(orderId: string, args: { amount: string; reason?: string }) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { payments: true },
    });
    if (!order) throw new Error('ORDER_NOT_FOUND');
    if (!['DELIVERED', 'RETURNED', 'CANCELLED'].includes(order.status)) {
      throw new Error('INVALID_TRANSITION');
    }
    if (parseFloat(args.amount) <= 0) throw new Error('INVALID_REFUND_AMOUNT');
    if (parseFloat(args.amount) > parseFloat(order.total.toString())) {
      throw new Error('REFUND_EXCEEDS_TOTAL');
    }

    const orderTotal = parseFloat(order.total.toString());
    const refundAmount = parseFloat(args.amount);
    const isFullRefund = refundAmount >= orderTotal;

    return this.prisma.$transaction(async (tx) => {
      await tx.payment.create({
        data: {
          orderId,
          gateway: order.paymentMethod,
          amount: args.amount,
          currency: order.currency,
          status: 'REFUNDED',
          failureReason: args.reason ?? null,
          rawResponse: { admin: true, reason: args.reason, refundedAt: new Date().toISOString() },
        },
      });
      return tx.order.update({
        where: { id: orderId },
        data: {
          paymentStatus: isFullRefund ? 'REFUNDED' : 'PARTIAL_REFUNDED',
          status: order.status === 'DELIVERED' ? 'REFUNDED' : order.status,
          notes: args.reason
            ? `${order.notes ?? ''}\n[Refund ₹${args.amount}]: ${args.reason}`.trim()
            : order.notes,
        },
        include: { items: true, shippingAddress: true, payments: true },
      });
    });
  }
}
