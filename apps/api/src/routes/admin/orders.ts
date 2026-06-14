import type { FastifyReply } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { OrderService } from '../../services/order.service.js';
import { NotificationService } from '../../services/notification.service.js';
import { serializeMoney } from '../../lib/decimal.js';

const ListQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  status: z
    .enum(['PENDING', 'CONFIRMED', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED', 'REFUNDED'])
    .optional(),
  paymentStatus: z
    .enum(['PENDING', 'AUTHORIZED', 'PAID', 'FAILED', 'REFUNDED', 'PARTIAL_REFUNDED'])
    .optional(),
  paymentMethod: z.enum(['RAZORPAY', 'COD', 'STRIPE']).optional(),
  search: z.string().min(1).max(120).optional(),
  placedFrom: z.coerce.date().optional(),
  placedTo: z.coerce.date().optional(),
  sort: z.enum(['placedAt-desc', 'placedAt-asc', 'total-desc', 'total-asc']).default('placedAt-desc'),
});

const ShipBody = z.object({
  carrier: z.string().trim().min(1).max(80),
  trackingNumber: z.string().trim().min(3).max(120),
  trackingUrl: z.string().trim().url().max(500).optional(),
});

const UpdateTrackingBody = z.object({
  carrier: z.string().trim().min(1).max(80).optional(),
  trackingNumber: z.string().trim().min(3).max(120).optional(),
  trackingUrl: z.string().trim().url().max(500).nullable().optional(),
});

const CancelBody = z.object({
  reason: z.string().trim().max(500).optional(),
});

const ReturnBody = z.object({
  reason: z.string().trim().max(500).optional(),
});

const RefundBody = z.object({
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
  reason: z.string().trim().max(500).optional(),
});

const IdParam = z.object({ id: z.string().uuid() });

function mapError(err: unknown, reply: FastifyReply) {
  if (err instanceof Error) {
    if (err.message === 'ORDER_NOT_FOUND') return reply.notFound('Order not found');
    if (err.message === 'INVALID_TRANSITION') {
      return reply.conflict('That status transition is not allowed from the current state');
    }
    if (err.message === 'MISSING_SHIPPING_ADDRESS') {
      return reply.badRequest('Order has no shipping address');
    }
    if (err.message === 'INVALID_REFUND_AMOUNT') return reply.badRequest('Refund amount must be greater than zero');
    if (err.message === 'REFUND_EXCEEDS_TOTAL') return reply.badRequest('Refund amount exceeds order total');
  }
  throw err;
}

const adminOrderRoutes: FastifyPluginAsyncZod = async (app) => {
  const orders = new OrderService(app.prisma);
  const notifications = new NotificationService(app.prisma);

  // Read scope: SUPPORT / ORDER_MANAGER / MANAGER + ADMIN.
  app.register(async (admin: typeof app) => {
    admin.addHook('preHandler', admin.requirePermission('view_orders'));

    admin.get(
      '/api/admin/orders',
      {
        schema: {
          tags: ['admin', 'orders'],
          summary: 'List orders with filters, search and pagination',
          querystring: ListQuery,
          security: [{ bearerAuth: [] }],
        },
      },
      async (req) => serializeMoney(await orders.adminList(req.query)),
    );

    admin.get(
      '/api/admin/orders/:id',
      {
        schema: {
          tags: ['admin', 'orders'],
          summary: 'Get a single order with items, shipping, payments, customer',
          params: IdParam,
          security: [{ bearerAuth: [] }],
        },
      },
      async (req, reply) => {
        const order = await orders.adminGet(req.params.id);
        if (!order) return reply.notFound('Order not found');
        return serializeMoney(order);
      },
    );

  });

  // Write scope: ORDER_MANAGER / MANAGER + ADMIN (mutates fulfilment state).
  app.register(async (admin: typeof app) => {
    admin.addHook('preHandler', admin.requirePermission('manage_orders'));

    // ---- Status transitions ----------------------------------------
    admin.post(
      '/api/admin/orders/:id/confirm',
      {
        schema: { tags: ['admin', 'orders'], params: IdParam, security: [{ bearerAuth: [] }] },
      },
      async (req, reply) => {
        try {
          const order = await orders.adminConfirm(req.params.id);
          void notifications.sendOrderConfirmation(order.id);
          return serializeMoney(order);
        } catch (err) {
          return mapError(err, reply);
        }
      },
    );

    admin.post(
      '/api/admin/orders/:id/pack',
      {
        schema: { tags: ['admin', 'orders'], params: IdParam, security: [{ bearerAuth: [] }] },
      },
      async (req, reply) => {
        try {
          return serializeMoney(await orders.adminMarkPacked(req.params.id));
        } catch (err) {
          return mapError(err, reply);
        }
      },
    );

    admin.post(
      '/api/admin/orders/:id/ship',
      {
        schema: {
          tags: ['admin', 'orders'],
          summary: 'Mark as shipped — requires carrier + tracking number',
          params: IdParam,
          body: ShipBody,
          security: [{ bearerAuth: [] }],
        },
      },
      async (req, reply) => {
        try {
          const order = await orders.adminShip(req.params.id, req.body);
          // TODO Phase 4: send shipping notification email with tracking link
          return serializeMoney(order);
        } catch (err) {
          return mapError(err, reply);
        }
      },
    );

    admin.patch(
      '/api/admin/orders/:id/tracking',
      {
        schema: {
          tags: ['admin', 'orders'],
          summary: 'Edit tracking info on an already-shipped order',
          params: IdParam,
          body: UpdateTrackingBody,
          security: [{ bearerAuth: [] }],
        },
      },
      async (req, reply) => {
        try {
          const order = await orders.adminUpdateTracking(req.params.id, {
            carrier: req.body.carrier,
            trackingNumber: req.body.trackingNumber,
            trackingUrl: req.body.trackingUrl ?? undefined,
          });
          return serializeMoney(order);
        } catch (err) {
          return mapError(err, reply);
        }
      },
    );

    admin.post(
      '/api/admin/orders/:id/deliver',
      {
        schema: { tags: ['admin', 'orders'], params: IdParam, security: [{ bearerAuth: [] }] },
      },
      async (req, reply) => {
        try {
          return serializeMoney(await orders.adminMarkDelivered(req.params.id));
        } catch (err) {
          return mapError(err, reply);
        }
      },
    );

    admin.post(
      '/api/admin/orders/:id/cancel',
      {
        schema: {
          tags: ['admin', 'orders'],
          summary: 'Cancel order (PENDING / CONFIRMED / PACKED) and restock',
          params: IdParam,
          body: CancelBody,
          security: [{ bearerAuth: [] }],
        },
      },
      async (req, reply) => {
        try {
          return serializeMoney(await orders.adminCancel(req.params.id, req.body.reason));
        } catch (err) {
          return mapError(err, reply);
        }
      },
    );

    admin.post(
      '/api/admin/orders/:id/return',
      {
        schema: {
          tags: ['admin', 'orders'],
          summary: 'Mark a SHIPPED/DELIVERED order as returned + restock',
          params: IdParam,
          body: ReturnBody,
          security: [{ bearerAuth: [] }],
        },
      },
      async (req, reply) => {
        try {
          return serializeMoney(await orders.adminMarkReturned(req.params.id, req.body.reason));
        } catch (err) {
          return mapError(err, reply);
        }
      },
    );

    admin.post(
      '/api/admin/orders/:id/refund',
      {
        schema: {
          tags: ['admin', 'orders'],
          summary: 'Record a refund (full or partial). Phase 3 wires to Razorpay refund API.',
          params: IdParam,
          body: RefundBody,
          security: [{ bearerAuth: [] }],
        },
      },
      async (req, reply) => {
        try {
          return serializeMoney(await orders.adminRefund(req.params.id, req.body));
        } catch (err) {
          return mapError(err, reply);
        }
      },
    );
  });
};

export default adminOrderRoutes;

