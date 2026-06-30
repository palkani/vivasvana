import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { prisma } from '@vivasvana/db';
import { OrderService } from '@/lib/server/services/order.service';
import { serializeMoney } from '@/lib/server/lib/decimal';
import { route, parseBody, parseQuery, json, badRequest, conflict, notFound } from '@/lib/server/http';
import { optionalAuth, requireAuth } from '@/lib/server/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
  /** 6-digit OTP from /api/auth/order/request-otp — proves the shopper
   *  owns the email the confirmation will be sent to. Optional at the
   *  schema layer so tests + local dev can bypass; OrderService enforces
   *  presence based on REQUIRE_ORDER_OTP env. */
  verificationCode: z.string().regex(/^\d{6}$/).optional(),
});

const ListQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(60).default(20),
});

/**
 * Maps OrderService domain errors to HTTP errors. Ported verbatim from the
 * Fastify route's `mapServiceError`; re-throws anything it doesn't recognise.
 */
function mapServiceError(err: unknown): never {
  if (err instanceof Error) {
    if (err.message === 'EMPTY_CART') throw badRequest('Your cart is empty');
    if (err.message === 'NEGATIVE_TOTAL') throw badRequest('Order total is invalid');
    if (err.message.startsWith('PRODUCT_UNAVAILABLE')) {
      throw conflict('A product in your cart is no longer available');
    }
    if (err.message.startsWith('INSUFFICIENT_STOCK')) {
      throw conflict('Not enough stock for one of the items in your cart');
    }
    if (err.message.startsWith('DISCOUNT_INVALID')) {
      const detail = err.message.split(':').slice(1).join(':').trim();
      throw badRequest(detail || 'Discount code is no longer valid');
    }
    if (err.message === 'DISCOUNT_USAGE_LIMIT_REACHED') {
      throw conflict('This discount code just reached its usage limit. Please try another.');
    }
    if (err.message === 'ORDER_NOT_FOUND') throw notFound('Order not found');
    if (err.message === 'ORDER_NOT_PENDING') {
      throw conflict('Order can no longer be cancelled');
    }
    // Verification OTP failures from OrderService.createFromCart.
    if (err.message === 'VERIFICATION_REQUIRED' || err.message === 'OTP_NOT_FOUND') {
      throw badRequest('Please request a confirmation code first.');
    }
    if (err.message === 'OTP_EXPIRED') {
      throw badRequest('Your confirmation code expired. Please request a new one.');
    }
    if (err.message === 'OTP_WRONG_CODE') {
      throw badRequest('That confirmation code is incorrect.');
    }
    if (err.message === 'OTP_TOO_MANY_ATTEMPTS') {
      throw badRequest('Too many failed attempts. Please request a new code.');
    }
  }
  throw err;
}
export { mapServiceError };

/**
 * Read (or mint + set) the cart session cookie. Mirrors the Fastify route's
 * `ensureSessionCookie`: same name (`vv_cart_sid`), same cross-site options in
 * production (sameSite:'none', secure), 30-day maxAge.
 */
async function ensureSessionCookie(): Promise<string> {
  const jar = await cookies();
  let sid = jar.get(SESSION_COOKIE)?.value;
  if (!sid) {
    sid = randomUUID();
    const prod = process.env.NODE_ENV === 'production';
    jar.set(SESSION_COOKIE, sid, {
      path: '/',
      httpOnly: true,
      // Cross-site cart cookie — see cart.ts for the full reasoning.
      sameSite: prod ? 'none' : 'lax',
      secure: prod,
      maxAge: 60 * 60 * 24 * 30,
    });
  }
  return sid;
}
export { ensureSessionCookie };

// -- Create order (guest OR user) --------------------------------------
export const POST = route(async (req) => {
  const user = await optionalAuth(req);
  const body = await parseBody(req, CreateOrderBody);
  const sessionId = await ensureSessionCookie();
  const service = new OrderService(prisma);
  try {
    const order = await service.createFromCart({
      userId: user?.id,
      sessionId,
      ...body,
    });
    return json(serializeMoney(order), { status: 201 });
  } catch (err) {
    return mapServiceError(err);
  }
});

// -- My orders (auth) --------------------------------------------------
export const GET = route(async (req) => {
  const user = await requireAuth(req);
  const query = parseQuery(req, ListQuery);
  const service = new OrderService(prisma);
  const result = await service.listForUser(user.id, query.page, query.pageSize);
  return json(serializeMoney(result));
});
