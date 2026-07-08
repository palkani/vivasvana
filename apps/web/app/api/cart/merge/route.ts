import { cookies } from 'next/headers';
import { prisma } from '@vivasvana/db';
import { CartService } from '@/lib/server/services/cart.service';
import { serializeMoney } from '@/lib/server/lib/decimal';
import { route, json } from '@/lib/server/http';
import { requireAuth } from '@/lib/server/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SESSION_COOKIE = 'vv_cart_sid';

/**
 * Merge the guest cart into the logged-in user's cart on sign-in.
 *
 * The guest session id lives in the HttpOnly `vv_cart_sid` cookie, which
 * JavaScript CANNOT read — so the client can't pass it in the body (the old
 * version tried to read document.cookie and always came up empty, so guest
 * carts were silently lost on login). We read it server-side from the cookie
 * instead. The browser sends it automatically on this same-origin request.
 */
export const POST = route(async (req) => {
  const user = await requireAuth(req);
  const jar = await cookies();
  const sessionId = jar.get(SESSION_COOKIE)?.value;
  const service = new CartService(prisma);

  const cart = sessionId
    ? await service.mergeGuestIntoUser({ userId: user.id, sessionId })
    : await service.getOrCreate({ userId: user.id });

  return json(serializeMoney(cart));
});