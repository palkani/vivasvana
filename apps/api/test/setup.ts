import { afterAll, beforeAll } from 'vitest';
import { prisma } from '@vivasvana/db';

beforeAll(async () => {
  // Reset state critical for our tests. Migrations are assumed applied by CI.
  // Order matters because of FK constraints (children → parents).
  await prisma.stockMovement.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.orderShipping.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.address.deleteMany();
  await prisma.productImage.deleteMany();
  await prisma.product.deleteMany();
  await prisma.discount.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});
