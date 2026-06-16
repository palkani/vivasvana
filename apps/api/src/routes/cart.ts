import type { FastifyRequest } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { CartService } from '../services/cart.service.js';
import { serializeMoney } from '../lib/decimal.js';

const SESSION_COOKIE = 'vv_cart_sid';
const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

const AddItem = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().optional(),
  quantity: z.coerce.number().int().positive().max(99).default(1),
});

const UpdateItem = z.object({
  quantity: z.coerce.number().int().min(0).max(99),
});

/**
 * Resolve cart ownership for a request:
 *  - If req.user is present → use userId
 *  - Else use sessionId from cookie (mint one if absent and set it back)
 */
function resolveOwner(
  req: FastifyRequest,
  reply: import('fastify').FastifyReply,
): { userId?: string; sessionId?: string } {
  if (req.user) {
    return { userId: req.user.id };
  }
  let sid = req.cookies[SESSION_COOKIE];
  if (!sid) {
    sid = randomUUID();
    reply.setCookie(SESSION_COOKIE, sid, {
      path: '/',
      httpOnly: true,
      // Web is on vercel.app, API is on up.railway.app — different
      // registrable domains, so the browser treats every cart fetch
      // as cross-site. SameSite=Lax cookies aren't sent on cross-site
      // fetch() calls, which made every add-to-cart create a fresh
      // session and the cart appear permanently empty. SameSite=None
      // sends the cookie, but it REQUIRES Secure — which is fine for
      // QA + prod (both HTTPS). In local dev (same-origin localhost)
      // we keep Lax + non-Secure so it works without HTTPS.
      ...crossSiteCookieFlags(),
      maxAge: SESSION_MAX_AGE,
    });
  }
  return { sessionId: sid };
}

function crossSiteCookieFlags() {
  const prod = process.env.NODE_ENV === 'production';
  return {
    sameSite: prod ? ('none' as const) : ('lax' as const),
    secure: prod,
  };
}

function mapServiceError(err: unknown, reply: import('fastify').FastifyReply) {
  if (err instanceof Error) {
    switch (err.message) {
      case 'PRODUCT_NOT_AVAILABLE':
        // Includes deleted, archived, AND draft products. Spelling it out
        // saves admins debugging "why can't I add my own draft?".
        return reply.notFound('This product is not available — it may be a draft, archived, or removed');
      case 'VARIANT_NOT_FOUND':
        return reply.notFound('Variant not found');
      case 'INSUFFICIENT_STOCK':
        return reply.conflict('Not enough stock');
      case 'ITEM_NOT_FOUND':
        return reply.notFound('Cart item not found');
    }
  }
  throw err;
}

const cartRoutes: FastifyPluginAsyncZod = async (app) => {
  const service = new CartService(app.prisma);

  app.get(
    '/api/cart',
    {
      preHandler: app.optionalAuth,
      schema: { tags: ['cart'], summary: 'Get the current cart' },
    },
    async (req, reply) => {
      const owner = resolveOwner(req, reply);
      const cart = await service.getOrCreate(owner);
      return serializeMoney(cart);
    },
  );

  app.post(
    '/api/cart/items',
    {
      preHandler: app.optionalAuth,
      schema: {
        tags: ['cart'],
        summary: 'Add an item to the cart',
        body: AddItem,
      },
    },
    async (req, reply) => {
      const owner = resolveOwner(req, reply);
      try {
        const cart = await service.addItem(owner, req.body);
        return reply.status(201).send(serializeMoney(cart));
      } catch (err) {
        return mapServiceError(err, reply);
      }
    },
  );

  app.put(
    '/api/cart/items/:itemId',
    {
      preHandler: app.optionalAuth,
      schema: {
        tags: ['cart'],
        summary: 'Update cart item quantity (0 = remove)',
        params: z.object({ itemId: z.string().uuid() }),
        body: UpdateItem,
      },
    },
    async (req, reply) => {
      const owner = resolveOwner(req, reply);
      const cart = await service.getOrCreate(owner);
      try {
        const result = await service.updateItem(cart.id, req.params.itemId, req.body.quantity);
        return serializeMoney(result);
      } catch (err) {
        return mapServiceError(err, reply);
      }
    },
  );

  app.delete(
    '/api/cart/items/:itemId',
    {
      preHandler: app.optionalAuth,
      schema: {
        tags: ['cart'],
        summary: 'Remove an item from the cart',
        params: z.object({ itemId: z.string().uuid() }),
      },
    },
    async (req, reply) => {
      const owner = resolveOwner(req, reply);
      const cart = await service.getOrCreate(owner);
      try {
        const result = await service.removeItem(cart.id, req.params.itemId);
        return serializeMoney(result);
      } catch (err) {
        return mapServiceError(err, reply);
      }
    },
  );

  app.post(
    '/api/cart/clear',
    {
      preHandler: app.optionalAuth,
      schema: { tags: ['cart'], summary: 'Empty the cart' },
    },
    async (req, reply) => {
      const owner = resolveOwner(req, reply);
      const cart = await service.getOrCreate(owner);
      const result = await service.clear(cart.id);
      return serializeMoney(result);
    },
  );

  app.post(
    '/api/cart/merge',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['cart'],
        summary: 'Merge guest cart into user cart on login',
        body: z.object({ sessionId: z.string().uuid() }),
        security: [{ bearerAuth: [] }],
      },
    },
    async (req) => {
      const merged = await service.mergeGuestIntoUser({
        userId: req.user!.id,
        sessionId: req.body.sessionId,
      });
      return serializeMoney(merged);
    },
  );
};

export default cartRoutes;

