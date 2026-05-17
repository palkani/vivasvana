'use client';

import { createSupabaseBrowserClient } from './supabase/client';
import { api } from './api';

/**
 * Wraps the typed api fetcher with the current Supabase access token so admin
 * components can call protected endpoints without passing tokens around.
 */
async function authHeader(): Promise<string | undefined> {
  const supabase = createSupabaseBrowserClient();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token;
}

export const adminApi = {
  async get<T>(path: string) {
    return api.get<T>(path, { accessToken: await authHeader(), cache: 'no-store' });
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
