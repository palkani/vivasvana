import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@vivasvana/db';
import { createTestApp, seedProduct } from './helpers.js';

const app = await createTestApp();
afterAll(async () => app.close());

beforeEach(async () => {
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.productImage.deleteMany();
  await prisma.product.deleteMany();
});

function getSessionCookie(res: { cookies: Array<{ name: string; value: string }> }) {
  return res.cookies.find((c) => c.name === 'vv_cart_sid')?.value;
}

describe('cart routes (guest)', () => {
  it('GET /api/cart creates a cart and sets the session cookie', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/cart' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.items).toEqual([]);
    expect(getSessionCookie(res)).toBeDefined();
  });

  it('POST /api/cart/items adds an item and reflects it in subsequent reads', async () => {
    const product = await seedProduct({ slug: 'p1', sku: 'P1' });

    const seed = await app.inject({ method: 'GET', url: '/api/cart' });
    const sid = getSessionCookie(seed);
    expect(sid).toBeDefined();

    const add = await app.inject({
      method: 'POST',
      url: '/api/cart/items',
      headers: { cookie: `vv_cart_sid=${sid}` },
      payload: { productId: product.id, quantity: 2 },
    });
    expect(add.statusCode).toBe(201);
    expect(add.json().items).toHaveLength(1);
    expect(add.json().items[0].quantity).toBe(2);

    const reread = await app.inject({
      method: 'GET',
      url: '/api/cart',
      headers: { cookie: `vv_cart_sid=${sid}` },
    });
    expect(reread.json().items[0].quantity).toBe(2);
  });

  it('adding the same product twice merges quantity', async () => {
    const product = await seedProduct({ slug: 'p1', sku: 'P1', stock: 10 });
    const seed = await app.inject({ method: 'GET', url: '/api/cart' });
    const sid = getSessionCookie(seed);
    const headers = { cookie: `vv_cart_sid=${sid}` };

    await app.inject({
      method: 'POST',
      url: '/api/cart/items',
      headers,
      payload: { productId: product.id, quantity: 1 },
    });
    const second = await app.inject({
      method: 'POST',
      url: '/api/cart/items',
      headers,
      payload: { productId: product.id, quantity: 3 },
    });
    const body = second.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].quantity).toBe(4);
  });

  it('rejects add when quantity exceeds stock', async () => {
    const product = await seedProduct({ slug: 'p1', sku: 'P1', stock: 2 });
    const seed = await app.inject({ method: 'GET', url: '/api/cart' });
    const sid = getSessionCookie(seed);

    const res = await app.inject({
      method: 'POST',
      url: '/api/cart/items',
      headers: { cookie: `vv_cart_sid=${sid}` },
      payload: { productId: product.id, quantity: 5 },
    });
    expect(res.statusCode).toBe(409);
  });

  it('PUT /api/cart/items/:id with quantity=0 removes the item', async () => {
    const product = await seedProduct({ slug: 'p1', sku: 'P1', stock: 10 });
    const seed = await app.inject({ method: 'GET', url: '/api/cart' });
    const sid = getSessionCookie(seed);
    const headers = { cookie: `vv_cart_sid=${sid}` };

    const added = await app.inject({
      method: 'POST',
      url: '/api/cart/items',
      headers,
      payload: { productId: product.id, quantity: 1 },
    });
    const itemId = added.json().items[0].id;

    const removed = await app.inject({
      method: 'PUT',
      url: `/api/cart/items/${itemId}`,
      headers,
      payload: { quantity: 0 },
    });
    expect(removed.json().items).toHaveLength(0);
  });

  it('rejects unpublished products', async () => {
    const product = await seedProduct({ slug: 'p1', sku: 'P1', status: 'DRAFT' });
    const seed = await app.inject({ method: 'GET', url: '/api/cart' });
    const sid = getSessionCookie(seed);

    const res = await app.inject({
      method: 'POST',
      url: '/api/cart/items',
      headers: { cookie: `vv_cart_sid=${sid}` },
      payload: { productId: product.id, quantity: 1 },
    });
    expect(res.statusCode).toBe(404);
  });
});
