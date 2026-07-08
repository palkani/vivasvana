import { cookies } from 'next/headers';
import { randomUUID } from 'node:crypto';
import { optionalAuth } from '@/lib/server/auth';
import { conflict, notFound } from '@/lib/server/http';

/**
 * Cart session cookie — ported verbatim from the Fastify cart route.
 *   name:   vv_cart_sid
 *   maxAge: 30 days
 * The value is a raw `randomUUID()` (an opaque, unguessable token), NOT a
 * signed cookie — the Fastify route used `reply.setCookie` without `signed`,
 * so there is no HMAC to reproduce. Next's cookie store doesn't sign either,
 * which matches the source exactly.
 */
const SESSION_COOKIE = 'vv_cart_sid';
const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

/**
 * Cart session cookie flags. The API is now SAME-ORIGIN with the storefront,
 * so the cookie must be `SameSite=Lax` — NOT `None`.
 *
 * `SameSite=None` is only for genuine cross-site cookies, and modern browsers
 * (Chrome's third-party-cookie phase-out, Safari ITP, Brave) block or
 * partition None cookies. That silently dropped `vv_cart_sid` in the browser,
 * so every `/api/cart` read started a fresh empty session → "your cart is
 * empty" even right after adding an item. Lax is sent on same-origin requests
 * and top-level navigations, which is exactly the cart flow. Secure in prod
 * (HTTPS); relaxed in local dev over http.
 */
function cartCookieFlags() {
  return {
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
  };
}

/**
 * Resolve cart ownership for a request:
 *  - If authenticated → use userId
 *  - Else use sessionId from cookie (mint one if absent and set it back on
 *    the outgoing response via next/headers `cookies().set`).
 */
export async function resolveCartOwner(
  req: Request,
): Promise<{ userId?: string; sessionId?: string }> {
  const user = await optionalAuth(req);
  if (user) {
    return { userId: user.id };
  }

  const jar = await cookies();
  let sid = jar.get(SESSION_COOKIE)?.value;
  if (!sid) {
    sid = randomUUID();
    jar.set(SESSION_COOKIE, sid, {
      path: '/',
      httpOnly: true,
      ...cartCookieFlags(),
      maxAge: SESSION_MAX_AGE,
    });
  }
  return { sessionId: sid };
}

/**
 * Map CartService domain errors to HTTP errors — mirrors the Fastify
 * `mapServiceError`. Unknown errors re-throw so `route()` returns a 500.
 */
export function mapCartServiceError(err: unknown): never {
  if (err instanceof Error) {
    switch (err.message) {
      case 'PRODUCT_NOT_AVAILABLE':
        throw notFound(
          'This product is not available — it may be a draft, archived, or removed',
        );
      case 'VARIANT_NOT_FOUND':
        throw notFound('Variant not found');
      case 'INSUFFICIENT_STOCK':
        throw conflict('Not enough stock');
      case 'ITEM_NOT_FOUND':
        throw notFound('Cart item not found');
    }
  }
  throw err;
}
