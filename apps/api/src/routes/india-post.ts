import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { lookupPincode } from '../integrations/india-post.js';

export default async function indiaPostRoutes(app: FastifyInstance) {
  app.get(
    '/api/pincode/:pin',
    {
      schema: {
        tags: ['utils'],
        summary: 'Look up an Indian PIN code → city/state',
        params: z.object({ pin: z.string().regex(/^[1-9]\d{5}$/) }),
      },
    },
    async (req, reply) => {
      const result = await lookupPincode(req.params.pin, app.redis);
      if (!result) return reply.notFound('PIN not found');
      return result;
    },
  );
}
