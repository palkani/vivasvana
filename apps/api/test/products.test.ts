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

describe('GET /api/products', () => {
  it('returns paginated list of published products', async () => {
    await seedProduct({ slug: 'p1', sku: 'P1', title: 'P1' });
    await seedProduct({ slug: 'p2', sku: 'P2', title: 'P2' });
    await seedProduct({ slug: 'draft', sku: 'D1', title: 'Draft', status: 'DRAFT' });

    const res = await app.inject({ method: 'GET', url: '/api/products' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.total).toBe(2); // draft excluded
    expect(body.items).toHaveLength(2);
    expect(body.items.every((p: { status: string }) => p.status === 'PUBLISHED')).toBe(true);
  });

  it('filters by price range', async () => {
    await seedProduct({ slug: 'cheap', sku: 'C1', price: '100.00' });
    await seedProduct({ slug: 'mid', sku: 'M1', price: '300.00' });
    await seedProduct({ slug: 'pricy', sku: 'P1', price: '900.00' });

    const res = await app.inject({ method: 'GET', url: '/api/products?minPrice=200&maxPrice=500' });
    const body = res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].slug).toBe('mid');
  });

  it('sorts by price ascending', async () => {
    await seedProduct({ slug: 'b', sku: 'B', price: '500.00' });
    await seedProduct({ slug: 'a', sku: 'A', price: '100.00' });

    const res = await app.inject({ method: 'GET', url: '/api/products?sort=price-asc' });
    const slugs = res.json().items.map((p: { slug: string }) => p.slug);
    expect(slugs).toEqual(['a', 'b']);
  });
});

describe('GET /api/products/:slug', () => {
  it('returns a single published product', async () => {
    await seedProduct({ slug: 'nutri-millet', sku: 'NM1', title: 'Nutri Millet' });
    const res = await app.inject({ method: 'GET', url: '/api/products/nutri-millet' });
    expect(res.statusCode).toBe(200);
    expect(res.json().title).toBe('Nutri Millet');
  });

  it('returns 404 for missing product', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/products/does-not-exist' });
    expect(res.statusCode).toBe(404);
  });

  it('returns 404 for draft product (not published)', async () => {
    await seedProduct({ slug: 'draft', sku: 'D1', status: 'DRAFT' });
    const res = await app.inject({ method: 'GET', url: '/api/products/draft' });
    expect(res.statusCode).toBe(404);
  });
});
