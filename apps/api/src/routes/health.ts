import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

const healthRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/health',
    {
      schema: {
        tags: ['health'],
        summary: 'Liveness check',
        response: {
          200: z.object({ status: z.literal('ok'), uptime: z.number() }),
        },
      },
    },
    async () => ({ status: 'ok' as const, uptime: process.uptime() }),
  );

  app.get(
    '/ready',
    {
      schema: {
        tags: ['health'],
        summary: 'Readiness check (db + redis reachable)',
        response: {
          200: z.object({
            status: z.literal('ok'),
            checks: z.object({ db: z.boolean(), redis: z.boolean() }),
          }),
          503: z.object({
            status: z.literal('degraded'),
            checks: z.object({ db: z.boolean(), redis: z.boolean() }),
          }),
        },
      },
    },
    async (_req, reply) => {
      const checks = { db: false, redis: false };
      try {
        await app.prisma.$queryRaw`SELECT 1`;
        checks.db = true;
      } catch {
        // fall through
      }
      try {
        const pong = await app.redis.ping();
        checks.redis = pong === 'PONG';
      } catch {
        // fall through
      }
      const ok = checks.db && checks.redis;
      return reply.status(ok ? 200 : 503).send({
        status: ok ? ('ok' as const) : ('degraded' as const),
        checks,
      });
    },
  );
};

export default healthRoutes;
