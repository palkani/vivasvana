import fp from 'fastify-plugin';
// ioredis 5.10+ uses ESM-style exports; named `Redis` is the class, the
// `default` is the namespace. Pull the class out explicitly so NodeNext
// resolution stays happy in the build output.
import { Redis } from 'ioredis';
import { env } from '../config/env.js';

declare module 'fastify' {
  interface FastifyInstance {
    redis: Redis;
  }
}

export default fp(
  async (app) => {
    const client = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      lazyConnect: false,
      enableOfflineQueue: false,
    });

    client.on('error', (err: Error) => {
      app.log.error({ err }, 'redis error');
    });

    app.decorate('redis', client);
    app.addHook('onClose', async () => {
      await client.quit();
    });
  },
  { name: 'redis' },
);
