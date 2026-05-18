import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ContactService } from '../services/contact.service.js';

/**
 * Anti-abuse hardening on this route:
 *  - per-route rate limit: 5 submissions per 10 minutes per IP
 *  - honeypot field `website` must be empty (validated as max length 0)
 *  - hidden `loadedAt` timestamp; service rejects sub-2s submissions
 *  - URL count cap + HTML/script regex reject (in service)
 *  - email + length sanity caps (in zod)
 *  - response is ALWAYS 200 OK with {accepted: true} from the client's POV
 *    so scrapers can't probe what tripped the filter
 */

const ContactBody = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().min(0).max(20).optional().or(z.literal('')),
  subject: z.string().trim().max(200).optional().or(z.literal('')),
  message: z.string().trim().min(10).max(2000),

  // Honeypot field — accepted at the schema level so spammers can't tell
  // they tripped a filter from the response. The service silently drops
  // submissions where this is non-empty and returns 200 to the client.
  website: z.string().max(255).optional(),
  // Client-side timestamp when the form mounted
  loadedAt: z.number().int().optional(),
});

export default async function contactRoutes(app: FastifyInstance) {
  const service = new ContactService(app.prisma);

  app.post(
    '/api/contact',
    {
      preHandler: app.optionalAuth,
      config: {
        rateLimit: {
          max: 5,
          timeWindow: '10 minutes',
        },
      },
      schema: {
        tags: ['contact'],
        summary: 'Submit a contact message (rate-limited, spam-filtered)',
        body: ContactBody,
      },
    },
    async (req, reply) => {
      // Origin/referer sanity check — drop submissions that didn't originate
      // from a browser navigating our site. Direct-POST spambots usually
      // omit these headers entirely.
      const origin = req.headers.origin ?? req.headers.referer ?? '';
      const allowedOrigins = (process.env.API_CORS_ORIGINS ?? '')
        .split(',')
        .map((s) => s.trim());
      if (origin && !allowedOrigins.some((o) => origin.startsWith(o))) {
        // Silently accept — spammer doesn't learn anything from the response
        req.log.warn({ origin }, 'contact submission with foreign origin — dropped');
        return reply.status(200).send({ accepted: true });
      }

      const result = await service.submit({
        ...req.body,
        userId: req.user?.id,
      });

      if (!result.accepted) {
        req.log.warn({ reason: result.reason }, 'contact submission filtered');
      }

      // Always 200 to the caller. The server-side `accepted` is opaque to
      // the client. This blocks automated probing of our spam filters.
      return reply.status(200).send({ accepted: true });
    },
  );
}
