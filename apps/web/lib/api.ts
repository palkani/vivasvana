import { env } from './env';

/**
 * Typed API client. Used by RSC + client components.
 *
 * Server components: `fetch` runs on the server, so cookies need to be
 * forwarded explicitly for cart session continuity. RSC callers pass
 * { cookie } from `next/headers`. Browser fetches send cookies automatically.
 */

/**
 * Resolve this deployment's own origin for server-side self-fetches to the
 * /api route handlers. On Vercel, VERCEL_URL is the deployment host (no
 * scheme); locally we fall back to NEXT_PUBLIC_SITE_URL.
 */
function serverOrigin(): string {
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return vercel.startsWith('http') ? vercel : `https://${vercel}`;
  return env.siteUrl;
}

export interface ApiError extends Error {
  status: number;
  payload: unknown;
}

interface RequestOptions extends RequestInit {
  /** Server-side cookie header to forward (RSC use case). */
  forwardCookies?: string;
  /** Supabase access token (Bearer). Only used in client components. */
  accessToken?: string;
  /** Next.js cache options. Default: no-store for write paths, revalidate for reads via overrides. */
  next?: NextFetchRequestConfig;
  /** Override cache value (Next 15 typings). */
  cache?: RequestCache;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  // The API now lives in THIS Next app as route handlers under /api/*, so
  // every call is same-origin — no Railway, no proxy rewrite.
  //
  // Browser: RELATIVE URL so the request hits our own origin and cart cookies
  // stay first-party.
  //
  // Server (RSC, server actions): fetch() needs an absolute URL, so resolve
  // our own deployment origin. This is a self-fetch to our own /api handlers.
  // (Follow-up optimization: RSC could import the service functions directly
  // and skip the HTTP hop entirely.)
  const isServer = typeof window === 'undefined';
  const base = isServer ? serverOrigin() : '';
  const url = path.startsWith('http') ? path : `${base}${path}`;
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (options.forwardCookies) headers.set('Cookie', options.forwardCookies);
  if (options.accessToken) headers.set('Authorization', `Bearer ${options.accessToken}`);

  // Hard timeout so a dead API doesn't hang Next.js's static-page worker
  // (which has its own 60s outer deadline). 8 s is comfortably more than
  // any real request should ever take but small enough to fail-fast on
  // localhost-misconfig during builds.
  const timeoutSignal = AbortSignal.timeout(8000);
  const combinedSignal = options.signal
    ? AbortSignal.any([options.signal, timeoutSignal])
    : timeoutSignal;

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
    signal: combinedSignal,
  });
  const text = await res.text();
  const payload = text ? safeJson(text) : null;

  if (!res.ok) {
    const err = new Error(
      (payload && typeof payload === 'object' && 'message' in payload ? String(payload.message) : res.statusText) ||
        `Request failed: ${res.status}`,
    ) as ApiError;
    err.status = res.status;
    err.payload = payload;
    throw err;
  }
  return payload as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, {
      ...options,
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, {
      ...options,
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, {
      ...options,
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  del: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'DELETE' }),
};
