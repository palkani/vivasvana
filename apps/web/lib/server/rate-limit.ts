import { tooManyRequests } from './http';

/**
 * Best-effort in-process rate limiter.
 *
 * ⚠️ SCOPE: this counts requests within a single warm serverless instance.
 * Vercel runs many instances, so this is NOT a hard global limit — it only
 * throttles a burst that happens to land on the same instance. It replaces
 * `@fastify/rate-limit`'s in-memory store, which had the exact same
 * single-process limitation on Railway, so behaviour is unchanged in spirit.
 *
 * For a hard, cross-instance limit (real abuse protection) use a shared
 * store — Upstash Redis ratelimit or Vercel's platform WAF/rate-limiting.
 * Deliberately left out to honour the "lean, no extra infra" rule; wire one
 * in if abuse becomes a real problem. See MIGRATION notes.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]!.trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}

/**
 * Throws 429 when `key` exceeds `max` hits within `windowMs`. Call at the top
 * of a handler, e.g. `rateLimit(`contact:${clientIp(req)}`, 5, 10 * 60_000)`.
 */
export function rateLimit(key: string, max: number, windowMs: number): void {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  bucket.count += 1;
  if (bucket.count > max) throw tooManyRequests();
}
