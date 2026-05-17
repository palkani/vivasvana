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
}
