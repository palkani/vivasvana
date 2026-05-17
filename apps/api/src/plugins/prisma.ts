import fp from 'fastify-plugin';
import { prisma } from '@vivasvana/db';
import type { PrismaClient } from '@vivasvana/db';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

export default fp(
  async (app) => {
    app.decorate('prisma', prisma);
    app.addHook('onClose', async () => {
      await prisma.$disconnect();
    });
  },
  { name: 'prisma' },
);
