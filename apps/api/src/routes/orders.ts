import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { OrderService } from '../services/order.service.js';
import { serializeMoney } from '../lib/decimal.js';

const SESSION_COOKIE = 'vv_cart_sid';

const IN_PINCODE = /^[1-9]\d{5}$/;

// Phone validation permissive: 7-20 chars covers India + intl. formats.
// Frontend doesn't enforce a pattern either. Re-tighten to ^[6-9]\d{9}$
// when we lock to India-only deliveries.
const PHONE = z.string().min(7).max(20);

const ShippingBody = z.object({
  name: z.string().min(1).max(120),
  phone: PHONE,
  addressLine: z.string().min(5).max(240),
  landmark: z.string().max(120).optional(),
  city: z.string().min(1).max(80),
  state: z.string().min(2).max(3),
  pincode: z.string().regex(IN_PINCODE),
  country: z.literal('IN').default('IN'),
});

const CreateOrderBody = z.object({
  email: z.string().email(),
  phone: PHONE,
  paymentMethod: z.enum(['RAZORPAY', 'COD', 'STRIPE']),
  shipping: ShippingBody,
  discountCode: z.string().max(40).optional(),
  gstin: z.string().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/).optional(),
  companyName: z.string().max(200).optional(),
  notes: z.string().max(1000).optional(),
});

function mapServiceError(err: unknown, reply: FastifyReply) {
  if (err instanceof Error) {
    if (err.message === 'EMPTY_CART') return reply.badRequest('Your cart is empty');
    if (err.message === 'NEGATIVE_TOTAL') return reply.badRequest('Order total is invalid');
    if (err.message.startsWith('PRODUCT_UNAVAILABLE')) {
      return reply.conflict('A product in your cart is no longer available');
    }
    if (err.message.startsWith('INSUFFICIENT_STOCK')) {
      return reply.conflict('Not enough stock for one of the items in your cart');
    }
    if (err.message.startsWith('DISCOUNT_INVALID')) {
      const detail = err.message.split(':').slice(1).join(':').trim();
      return reply.badRequest(detail || 'Discount code is no longer valid');
    }
    if (err.message === 'ORDER_NOT_FOUND') return reply.notFound('Order not found');
    if (err.message === 'ORDER_NOT_PENDING') {
      return reply.conflict('Order can no longer be cancelled');
    }
  }
  throw err;
}

function ensureSessionCookie(req: import('fastify').FastifyRequest, reply: FastifyReply) {
  let sid = req.cookies[SESSION_COOKIE];
  if (!sid) {
    sid = randomUUID();
    reply.setCookie(SESSION_COOKIE, sid, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 30,
    });
  }
  return sid;
}

export default async function orderRoutes(app: FastifyInstance) {
  const service = new OrderService(app.prisma);

  // -- Create order (guest OR user) --------------------------------------
  app.post(
    '/api/orders',
    {
      preHandler: app.optionalAuth,
      schema: {
        tags: ['orders'],
        summary: 'Create an order from the current cart',
        body: CreateOrderBody,
      },
    },
    async (req, reply) => {
      const sessionId = ensureSessionCookie(req, reply);
      try {
        const order = await service.createFromCart({
          userId: req.user?.id,
          sessionId,
          ...req.body,
        });
        return reply.status(201).send(serializeMoney(order));
      } catch (err) {
        return mapServiceError(err, reply);
      }
    },
  );

  // -- Public lookup by UUID (used by /pay/:orderId during checkout) ------
  // The order ID is a v4 UUID, so the URL itself is the capability. We DO NOT
  // return payment details here — just enough to render the payment page.
  app.get(
    '/api/orders/by-id/:id',
    {
      schema: {
        tags: ['orders'],
        summary: 'Get an order by UUID (capability link — used right after checkout)',
        params: z.object({ id: z.string().uuid() }),
      },
    },
    async (req, reply) => {
      const order = await app.prisma.order.findUnique({
        where: { id: req.params.id },
        include: { items: true, shippingAddress: true },
      });
      if (!order) return reply.notFound('Order not found');
      return serializeMoney(order);
    },
  );

  // -- Public lookup (orderNumber + email) -------------------------------
  app.get(
    '/api/orders/lookup',
    {
      schema: {
        tags: ['orders'],
        summary: 'Look up an order by number + email (guest confirmation page)',
        querystring: z.object({
          orderNumber: z.string().min(1),
          email: z.string().email(),
        }),
      },
    },
    async (req, reply) => {
      const order = await service.getPublic(req.query.orderNumber, req.query.email);
      if (!order) return reply.notFound('Order not found');
      return serializeMoney(order);
    },
  );

  // -- My orders (auth) --------------------------------------------------
  app.register(async (auth) => {
    auth.addHook('preHandler', auth.authenticate);

    auth.get(
      '/api/orders',
      {
        schema: {
          tags: ['orders'],
          summary: 'List my orders',
          querystring: z.object({
            page: z.coerce.number().int().positive().default(1),
            pageSize: z.coerce.number().int().positive().max(60).default(20),
          }),
          security: [{ bearerAuth: [] }],
        },
      },
      async (req) => {
        const result = await service.listForUser(req.user!.id, req.query.page, req.query.pageSize);
        return serializeMoney(result);
      },
    );

    auth.get(
      '/api/orders/:id',
      {
        schema: {
          tags: ['orders'],
          summary: 'Get one of my orders',
          params: z.object({ id: z.string().uuid() }),
          security: [{ bearerAuth: [] }],
        },
      },
      async (req, reply) => {
        const order = await service.getForUser(req.params.id, req.user!.id);
        if (!order) return reply.notFound('Order not found');
        return serializeMoney(order);
      },
    );

    auth.post(
      '/api/orders/:id/cancel',
      {
        schema: {
          tags: ['orders'],
          summary: 'Cancel my pending order',
          params: z.object({ id: z.string().uuid() }),
          security: [{ bearerAuth: [] }],
        },
      },
      async (req, reply) => {
        // Confirm ownership before passing to service
        const owned = await app.prisma.order.findFirst({
          where: { id: req.params.id, userId: req.user!.id },
          select: { id: true },
        });
        if (!owned) return reply.notFound('Order not found');
        try {
          const cancelled = await service.cancelPending(owned.id);
          return serializeMoney(cancelled);
        } catch (err) {
          return mapServiceError(err, reply);
        }
      },
    );
  });
}
