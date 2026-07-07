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
 * Cross-site cookie flags (matches Fastify `crossSiteCookieFlags`):
 * In prod the web + API used to be different registrable domains, so the
 * cookie needed SameSite=None;Secure to ride along on cross-site fetches.
 * Now same-origin, but we keep identical flags so behaviour is unchanged.
 * Local dev (non-HTTPS) keeps Lax + non-Secure.
 */
function crossSiteCookieFlags() {
  const prod = process.env.NODE_ENV === 'production';
  return {
    sameSite: prod ? ('none' as const) : ('lax' as const),
    secure: prod,
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
      ...crossSiteCookieFlags(),
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
