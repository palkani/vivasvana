'use client';

import { createSupabaseBrowserClient } from './supabase/client';
import { api } from './api';

/**
 * Wraps the typed API fetcher with the current Supabase access token. Used by
 * customer-account components (orders, addresses, profile) to call protected
 * endpoints without each component touching the session.
 */
async function authHeader(): Promise<string | undefined> {
  const supabase = createSupabaseBrowserClient();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token;
}

export const accountApi = {
  async get<T>(path: string, options: { cache?: RequestCache } = {}) {
    return api.get<T>(path, { accessToken: await authHeader(), cache: options.cache ?? 'no-store' });
  },
  async post<T>(path: string, body?: unknown) {
    return api.post<T>(path, body, { accessToken: await authHeader() });
  },
  async put<T>(path: string, body?: unknown) {
    return api.put<T>(path, body, { accessToken: await authHeader() });
  },
  async del<T>(path: string) {
    return api.del<T>(path, { accessToken: await authHeader() });
  },
};
