import { env } from './env';

/**
 * Typed API client. Used by RSC + client components.
 *
 * Server components: `fetch` runs on the server, so cookies need to be
 * forwarded explicitly for cart session continuity. RSC callers pass
 * { cookie } from `next/headers`. Browser fetches send cookies automatically.
 */

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
  const url = path.startsWith('http') ? path : `${env.apiUrl}${path}`;
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (options.forwardCookies) headers.set('Cookie', options.forwardCookies);
  if (options.accessToken) headers.set('Authorization', `Bearer ${options.accessToken}`);

  const res = await fetch(url, { ...options, headers, credentials: 'include' });
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
  del: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'DELETE' }),
};
