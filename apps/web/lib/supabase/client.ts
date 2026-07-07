'use client';
import { createBrowserClient } from '@supabase/ssr';
import { env } from '../env';

/**
 * Browser Supabase client. Throws an attributable error when the
 * NEXT_PUBLIC_SUPABASE_* env vars weren't baked into the build, so a
 * caller's stack trace points back to the misconfig instead of the
 * SDK's generic "URL and Key are required" message.
 */
export function createSupabaseBrowserClient() {
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    const missing = [
      !env.supabaseUrl && 'NEXT_PUBLIC_SUPABASE_URL',
      !env.supabaseAnonKey && 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    ]
      .filter(Boolean)
      .join(', ');

    if (typeof window !== 'undefined') {
      console.error('[vivasvana:supabase/client] missing env vars:', missing);
    }
    throw new Error(
      `Supabase browser client cannot be created — ${missing} not in build. ` +
        `Likely cause: var isn't set in Vercel for the Production environment, ` +
        `or the deploy used a cached build that predated the var.`,
    );
  }
  return createBrowserClient(env.supabaseUrl, env.supabaseAnonKey);
}
