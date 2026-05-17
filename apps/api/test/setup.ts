import { afterAll, beforeAll } from 'vitest';
import { prisma } from '@vivasvana/db';

beforeAll(async () => {
  // Reset state critical for our tests. Migrations are assumed applied by CI.
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.productImage.deleteMany();
  await prisma.product.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});
