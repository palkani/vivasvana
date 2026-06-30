import { z } from 'zod';
import { prisma } from '@vivasvana/db';
import { ContactService } from '@/lib/server/services/contact.service';
import { route, parseBody, json } from '@/lib/server/http';
import { optionalAuth } from '@/lib/server/auth';
import { rateLimit, clientIp } from '@/lib/server/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Anti-abuse hardening (unchanged from the Fastify route):
 *  - per-IP rate limit: 5 submissions / 10 min (best-effort, see rate-limit.ts)
 *  - honeypot `website` must be empty; service drops non-empty silently
 *  - hidden `loadedAt` timestamp; service rejects sub-2s submissions
 *  - URL count cap + HTML/script reject (in service)
 *  - response is ALWAYS 200 {accepted:true} so scrapers can't probe filters
 */
const ContactBody = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().min(0).max(20).optional().or(z.literal('')),
  subject: z.string().trim().max(200).optional().or(z.literal('')),
  message: z.string().trim().min(10).max(2000),
  website: z.string().max(255).optional(),
  loadedAt: z.number().int().optional(),
});

export const POST = route(async (req) => {
  rateLimit(`contact:${clientIp(req)}`, 5, 10 * 60 * 1000);

  const user = await optionalAuth(req);
  const body = await parseBody(req, ContactBody);

  // Origin/referer sanity check — drop submissions that didn't originate from
  // a browser on our site. Now that the API is same-origin with the app, a
  // legitimate browser submission always carries a matching origin.
  const origin = req.headers.get('origin') ?? req.headers.get('referer') ?? '';
  const allowed = (process.env.APP_ALLOWED_ORIGINS ?? process.env.API_CORS_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (origin && allowed.length > 0 && !allowed.some((o) => origin.startsWith(o))) {
    console.warn('[api] contact submission with foreign origin — dropped', { origin });
    return json({ accepted: true });
  }

  const service = new ContactService(prisma);
  const result = await service.submit({ ...body, userId: user?.id });
  if (!result.accepted) {
    console.warn('[api] contact submission filtered', { reason: result.reason });
  }

  // Always 200 — server-side `accepted` is opaque to the client.
  return json({ accepted: true });
});
