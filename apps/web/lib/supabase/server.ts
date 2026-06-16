import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { env } from '../env';

interface CookieToSet {
  name: string;
  value: string;
  options?: CookieOptions;
}

/**
 * Server-side Supabase client. Reads/writes the auth cookie via Next's
 * cookies() so RSC + Route Handlers can refresh the session transparently.
 *
 * Throws a clear, attributable error when env vars are missing rather
 * than letting the SDK's generic "Your project's URL and Key are
 * required to create a Supabase client!" message bubble. The error's
 * cause includes which env vars are absent so the Vercel runtime log
 * tells you exactly what to add.
 */
export async function createSupabaseServerClient() {
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    const missing = [
      !env.supabaseUrl && 'NEXT_PUBLIC_SUPABASE_URL',
      !env.supabaseAnonKey && 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    ]
      .filter(Boolean)
      .join(', ');

    // eslint-disable-next-line no-console
    console.error('[vivasvana:supabase/server] missing env vars:', {
      missing,
      apiUrl: env.apiUrl,
      siteUrl: env.siteUrl,
      hint:
        'Set these in Vercel → Settings → Environment Variables (tick Production), ' +
        'then push an empty commit to retrigger the GH Actions workflow so the build re-runs.',
    });

    throw new Error(
      `Supabase client cannot be created — missing env vars: ${missing}. ` +
        `Check Vercel runtime logs for [vivasvana:supabase/server] for the full snapshot.`,
    );
  }

  const cookieStore = await cookies();
  return createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet: CookieToSet[]) => {
        try {
          toSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // In RSC, set() throws — middleware refresh handles it, swallow here.
        }
      },
    },
  });
}
