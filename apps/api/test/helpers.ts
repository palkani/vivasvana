import { buildApp } from '../src/app.js';
import { prisma } from '@vivasvana/db';

export async function createTestApp() {
  const app = await buildApp({ logger: false });
  await app.ready();
  return app;
}

export async function seedProduct(overrides: Partial<{
  slug: string;
  title: string;
  sku: string;
  price: string;
  stock: number;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
}> = {}) {
  return prisma.product.create({
    data: {
      slug: overrides.slug ?? 'test-product',
      title: overrides.title ?? 'Test Product',
      sku: overrides.sku ?? 'TEST-001',
      description: 'Test description',
      price: overrides.price ?? '299.00',
      stock: overrides.stock ?? 10,
      status: overrides.status ?? 'PUBLISHED',
    },
  });
}
