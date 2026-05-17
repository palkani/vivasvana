import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@vivasvana/db';
import { createTestApp, seedProduct } from './helpers.js';

const app = await createTestApp();
afterAll(async () => app.close());

beforeEach(async () => {
  await prisma.stockMovement.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.orderShipping.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.productImage.deleteMany();
  await prisma.product.deleteMany();
  await prisma.discount.deleteMany();
});

const baseShipping = {
  name: 'Test User',
  phone: '9876543210',
  addressLine: '12 MG Road',
  city: 'Bengaluru',
  state: 'KA',
  pincode: '560001',
  country: 'IN' as const,
};

async function addToCart(productId: string, qty = 1) {
  const seed = await app.inject({ method: 'GET', url: '/api/cart' });
  const sid = seed.cookies.find((c) => c.name === 'vv_cart_sid')!.value;
  await app.inject({
    method: 'POST',
    url: '/api/cart/items',
    headers: { cookie: `vv_cart_sid=${sid}` },
    payload: { productId, quantity: qty },
  });
  return sid;
}

describe('POST /api/orders', () => {
  it('creates an order, decrements stock, empties cart', async () => {
    const product = await seedProduct({ slug: 'p', sku: 'P1', stock: 10, price: '299.00' });
    const sid = await addToCart(product.id, 2);

    const res = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: { cookie: `vv_cart_sid=${sid}` },
      payload: {
        email: 'buyer@example.com',
        phone: '9876543210',
        paymentMethod: 'COD',
        shipping: baseShipping,
      },
    });
    expect(res.statusCode).toBe(201);
    const order = res.json();
    expect(order.orderNumber).toMatch(/^VV\d{4}-\d{6}$/);
    expect(order.items).toHaveLength(1);
    expect(order.items[0].quantity).toBe(2);
    expect(order.codFee).toBe('50.00');
    expect(order.status).toBe('PENDING');

    // Stock decremented
    const fresh = await prisma.product.findUnique({ where: { id: product.id } });
    expect(fresh!.stock).toBe(8);

    // Cart emptied
    const cart = await prisma.cart.findFirst({ where: { sessionId: sid } });
    const items = cart ? await prisma.cartItem.count({ where: { cartId: cart.id } }) : 0;
    expect(items).toBe(0);

    // Stock movement audit row written
    const movements = await prisma.stockMovement.findMany({ where: { productId: product.id } });
    expect(movements).toHaveLength(1);
    expect(movements[0]!.delta).toBe(-2);
  });

  it('rejects when cart is empty', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders',
      payload: {
        email: 'buyer@example.com',
        phone: '9876543210',
        paymentMethod: 'COD',
        shipping: baseShipping,
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects when stock changed underneath us', async () => {
    const product = await seedProduct({ slug: 'p', sku: 'P1', stock: 5 });
    const sid = await addToCart(product.id, 5);

    // Race: another order eats 4 units before this checkout runs
    await prisma.product.update({ where: { id: product.id }, data: { stock: 1 } });

    const res = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: { cookie: `vv_cart_sid=${sid}` },
      payload: {
        email: 'buyer@example.com',
        phone: '9876543210',
        paymentMethod: 'COD',
        shipping: baseShipping,
      },
    });
    expect(res.statusCode).toBe(409);
  });

  it('applies a percentage discount and records usage', async () => {
    const product = await seedProduct({ slug: 'p', sku: 'P1', stock: 10, price: '500.00' });
    await prisma.discount.create({
      data: {
        code: 'TEN',
        type: 'PERCENTAGE',
        value: '10.00',
        status: 'ACTIVE',
      },
    });
    const sid = await addToCart(product.id, 1);

    const res = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: { cookie: `vv_cart_sid=${sid}` },
      payload: {
        email: 'buyer@example.com',
        phone: '9876543210',
        paymentMethod: 'COD',
        shipping: baseShipping,
        discountCode: 'TEN',
      },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().discount).toBe('50.00');

    const used = await prisma.discount.findUnique({ where: { code: 'TEN' } });
    expect(used!.usedCount).toBe(1);
  });

  it('rejects invalid discount code', async () => {
    const product = await seedProduct({ slug: 'p', sku: 'P1', stock: 10 });
    const sid = await addToCart(product.id, 1);

    const res = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: { cookie: `vv_cart_sid=${sid}` },
      payload: {
        email: 'buyer@example.com',
        phone: '9876543210',
        paymentMethod: 'COD',
        shipping: baseShipping,
        discountCode: 'DOES_NOT_EXIST',
      },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('mock payment flow', () => {
  it('transitions PENDING → CONFIRMED on simulate success', async () => {
    const product = await seedProduct({ slug: 'p', sku: 'P1', stock: 10 });
    const sid = await addToCart(product.id, 1);
    const orderRes = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: { cookie: `vv_cart_sid=${sid}` },
      payload: {
        email: 'buyer@example.com',
        phone: '9876543210',
        paymentMethod: 'RAZORPAY',
        shipping: baseShipping,
      },
    });
    const order = orderRes.json();

    await app.inject({ method: 'POST', url: '/api/payments/intents', payload: { orderId: order.id } });
    const confirm = await app.inject({
      method: 'POST',
      url: `/api/payments/mock-confirm/${order.id}`,
      payload: { success: true },
    });
    expect(confirm.statusCode).toBe(200);
    const after = confirm.json();
    expect(after.status).toBe('CONFIRMED');
    expect(after.paymentStatus).toBe('PAID');
  });

  it('marks paymentStatus FAILED on simulate failure', async () => {
    const product = await seedProduct({ slug: 'p', sku: 'P1', stock: 10 });
    const sid = await addToCart(product.id, 1);
    const orderRes = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: { cookie: `vv_cart_sid=${sid}` },
      payload: {
        email: 'buyer@example.com',
        phone: '9876543210',
        paymentMethod: 'RAZORPAY',
        shipping: baseShipping,
      },
    });
    const order = orderRes.json();
    await app.inject({ method: 'POST', url: '/api/payments/intents', payload: { orderId: order.id } });
    const confirm = await app.inject({
      method: 'POST',
      url: `/api/payments/mock-confirm/${order.id}`,
      payload: { success: false, failureReason: 'card declined' },
    });
    expect(confirm.statusCode).toBe(200);
    expect(confirm.json().paymentStatus).toBe('FAILED');
    expect(confirm.json().status).toBe('PENDING'); // order can still be retried
  });
});

describe('GET /api/orders/lookup', () => {
  it('returns the order when number + email match', async () => {
    const product = await seedProduct({ slug: 'p', sku: 'P1', stock: 10 });
    const sid = await addToCart(product.id, 1);
    const created = (
      await app.inject({
        method: 'POST',
        url: '/api/orders',
        headers: { cookie: `vv_cart_sid=${sid}` },
        payload: {
          email: 'buyer@example.com',
          phone: '9876543210',
          paymentMethod: 'COD',
          shipping: baseShipping,
        },
      })
    ).json();

    const res = await app.inject({
      method: 'GET',
      url: `/api/orders/lookup?orderNumber=${created.orderNumber}&email=buyer@example.com`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().id).toBe(created.id);
  });

  it('returns 404 when email does not match', async () => {
    const product = await seedProduct({ slug: 'p', sku: 'P1', stock: 10 });
    const sid = await addToCart(product.id, 1);
    const created = (
      await app.inject({
        method: 'POST',
        url: '/api/orders',
        headers: { cookie: `vv_cart_sid=${sid}` },
        payload: {
          email: 'buyer@example.com',
          phone: '9876543210',
          paymentMethod: 'COD',
          shipping: baseShipping,
        },
      })
    ).json();

    const res = await app.inject({
      method: 'GET',
      url: `/api/orders/lookup?orderNumber=${created.orderNumber}&email=wrong@example.com`,
    });
    expect(res.statusCode).toBe(404);
  });
});
