import fp from 'fastify-plugin';
import Redis from 'ioredis';
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

    client.on('error', (err) => {
      app.log.error({ err }, 'redis error');
    });

    app.decorate('redis', client);
    app.addHook('onClose', async () => {
      await client.quit();
    });
  },
  { name: 'redis' },
);
