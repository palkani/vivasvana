import type { PrismaClient, Order, Prisma } from '@vivasvana/db';

/**
 * Payment provider interface. Razorpay (Phase 3) will implement this directly.
 * For Phase 2 we ship a Mock provider so end-to-end checkout works without
 * external dependencies.
 *
 * Lifecycle:
 *   createIntent(order) — register a payment with the gateway, return id
 *   confirm(payload)    — gateway → us callback, marks order PAID
 *   refund(payment, ?)  — issue refund, marks payment REFUNDED
 *
 * COD is handled separately: no intent, no confirm — order is CONFIRMED
 * on creation and paymentStatus stays PENDING until delivery.
 */

export interface PaymentIntent {
  gateway: 'RAZORPAY' | 'COD' | 'STRIPE';
  gatewayOrderId: string;
  amount: string; // INR string, "999.99"
  currency: 'INR';
}

export class PaymentService {
  constructor(private readonly prisma: PrismaClient) {}

  // ---------------------------------------------------------------------
  // COD: confirm the order directly. No external call.
  // ---------------------------------------------------------------------
  async confirmCOD(orderId: string) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) throw new Error('ORDER_NOT_FOUND');
      if (order.paymentMethod !== 'COD') throw new Error('NOT_COD_ORDER');
      if (order.status !== 'PENDING') throw new Error('ORDER_NOT_PENDING');

      await tx.payment.create({
        data: {
          orderId: order.id,
          gateway: 'COD',
          amount: order.total,
          currency: order.currency,
          status: 'PENDING', // collected on delivery
        },
      });

      return tx.order.update({
        where: { id: order.id },
        data: { status: 'CONFIRMED', confirmedAt: new Date() },
      });
    });
  }

  // ---------------------------------------------------------------------
  // Mock provider (stand-in for Razorpay until Phase 3)
  // ---------------------------------------------------------------------
  async createMockIntent(order: Order): Promise<PaymentIntent> {
    const gatewayOrderId = `mock_${order.id.slice(0, 8)}_${Date.now()}`;
    await this.prisma.payment.create({
      data: {
        orderId: order.id,
        gateway: 'RAZORPAY', // we keep RAZORPAY as the gateway tag even in mock so the
                             // real provider can plug in without a schema migration
        gatewayOrderId,
        amount: order.total,
        currency: 'INR',
        status: 'PENDING',
        rawResponse: { provider: 'mock', createdAt: new Date().toISOString() },
      },
    });
    return {
      gateway: 'RAZORPAY',
      gatewayOrderId,
      amount: order.total.toString(),
      currency: 'INR',
    };
  }

  /**
   * Mock confirm — called by the /pay/[orderId] page's "Simulate success"
   * button. Real Razorpay flow will replace this with a webhook handler
   * that verifies HMAC + marks the order paid.
   */
  async confirmMock(
    orderId: string,
    args: { success: boolean; failureReason?: string },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { payments: true },
      });
      if (!order) throw new Error('ORDER_NOT_FOUND');
      if (order.status !== 'PENDING') throw new Error('ORDER_NOT_PENDING');

      const pending = order.payments.find((p) => p.status === 'PENDING');
      if (!pending) throw new Error('NO_PENDING_PAYMENT');

      if (args.success) {
        await tx.payment.update({
          where: { id: pending.id },
          data: {
            status: 'PAID',
            gatewayPaymentId: `mock_pay_${pending.id.slice(0, 8)}`,
            rawResponse: {
              ...(pending.rawResponse as Prisma.JsonObject),
              confirmedAt: new Date().toISOString(),
            },
          },
        });
        return tx.order.update({
          where: { id: order.id },
          data: {
            status: 'CONFIRMED',
            paymentStatus: 'PAID',
            confirmedAt: new Date(),
          },
        });
      }

      await tx.payment.update({
        where: { id: pending.id },
        data: {
          status: 'FAILED',
          failureReason: args.failureReason ?? 'mock failure',
        },
      });
      return tx.order.update({
        where: { id: order.id },
        data: { paymentStatus: 'FAILED' },
      });
    });
  }

  async getOrderPaymentSummary(orderId: string) {
    const payments = await this.prisma.payment.findMany({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
    });
    return payments;
  }
}
