import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { lookupPincode, searchCitiesByName } from '../integrations/india-post.js';

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

  app.get(
    '/api/cities/search',
    {
      schema: {
        tags: ['utils'],
        summary:
          'Typeahead search across India Post post-office directory ' +
          '(~150k places). Grouped to one row per district + state.',
        querystring: z.object({
          q: z.string().min(2).max(60),
        }),
      },
    },
    async (req) => {
      const hits = await searchCitiesByName(req.query.q, app.redis);
      return { items: hits };
    },
  );
}
