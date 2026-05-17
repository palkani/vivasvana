import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { PaymentService } from '../services/payment.service.js';
import { serializeMoney } from '../lib/decimal.js';

function mapPaymentError(err: unknown, reply: FastifyReply) {
  if (err instanceof Error) {
    if (err.message === 'ORDER_NOT_FOUND') return reply.notFound('Order not found');
    if (err.message === 'ORDER_NOT_PENDING') return reply.conflict('Order is no longer pending');
    if (err.message === 'NOT_COD_ORDER') return reply.badRequest('Order is not COD');
    if (err.message === 'NO_PENDING_PAYMENT') {
      return reply.conflict('No pending payment to confirm');
    }
  }
  throw err;
}

const PayOrderParams = z.object({ orderId: z.string().uuid() });

export default async function paymentRoutes(app: FastifyInstance) {
  const service = new PaymentService(app.prisma);

  // -- Create a (mock) payment intent for an order -----------------------
  app.post(
    '/api/payments/intents',
    {
      schema: {
        tags: ['payments'],
        summary: 'Create a payment intent for a pending order',
        body: z.object({ orderId: z.string().uuid() }),
      },
    },
    async (req, reply) => {
      const order = await app.prisma.order.findUnique({ where: { id: req.body.orderId } });
      if (!order) return reply.notFound('Order not found');
      if (order.status !== 'PENDING') return reply.conflict('Order is no longer pending');
      if (order.paymentMethod === 'COD') return reply.badRequest('COD orders do not use intents');
      try {
        const intent = await service.createMockIntent(order);
        return reply.status(201).send(intent);
      } catch (err) {
        return mapPaymentError(err, reply);
      }
    },
  );

  // -- Mock confirm (replaces the Razorpay webhook for now) --------------
  app.post(
    '/api/payments/mock-confirm/:orderId',
    {
      schema: {
        tags: ['payments'],
        summary: 'Mock-confirm a payment (Phase 2 stand-in for Razorpay)',
        params: PayOrderParams,
        body: z.object({
          success: z.boolean(),
          failureReason: z.string().max(200).optional(),
        }),
      },
    },
    async (req, reply) => {
      try {
        const order = await service.confirmMock(req.params.orderId, req.body);
        return serializeMoney(order);
      } catch (err) {
        return mapPaymentError(err, reply);
      }
    },
  );

  // -- COD confirm (no payment intent — straight to CONFIRMED) -----------
  app.post(
    '/api/payments/cod-confirm/:orderId',
    {
      schema: {
        tags: ['payments'],
        summary: 'Confirm a COD order (no money moves until delivery)',
        params: PayOrderParams,
      },
    },
    async (req, reply) => {
      try {
        const order = await service.confirmCOD(req.params.orderId);
        return serializeMoney(order);
      } catch (err) {
        return mapPaymentError(err, reply);
      }
    },
  );
}
