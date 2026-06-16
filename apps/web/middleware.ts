import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { env } from '@/lib/env';

interface CookieToSet {
  name: string;
  value: string;
  options?: CookieOptions;
}

/**
 * Three jobs:
 *  1. Refresh the Supabase session cookie on every request (so RSC reads see a fresh user).
 *  2. Gate /admin/* on a logged-in user (role check happens in the API on every call).
 *  3. Gate /account/* (except /account/login) on a logged-in user.
 *
 * Why gate at the edge and not in the layout? Calling `redirect()` from a
 * server-component layout throws NEXT_REDIRECT internally; Next catches it,
 * but the dev overlay surfaces the throw as a Console Error. Edge-level
 * redirects are quiet and faster (no layout render before the bounce).
 */
const ADMIN_LOGIN_PATH = '/admin/login';
const ACCOUNT_LOGIN_PATH = '/account/login';

// Dev-only bypass for /admin/*. Honored only when not in production.
const ADMIN_AUTH_DISABLED =
  process.env.NODE_ENV !== 'production' &&
  process.env.NEXT_PUBLIC_ADMIN_AUTH_DISABLED === 'true';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Fail-safe: if Supabase env vars haven't been wired (Vercel misconfig,
  // missing NEXT_PUBLIC_SUPABASE_URL/_ANON_KEY), don't crash the entire
  // app with MIDDLEWARE_INVOCATION_FAILED. Skip auth gating instead so
  // public pages still load and the operator can hit /api/_env-check to
  // diagnose. Routes that genuinely need a session will redirect via
  // their layout-level checks anyway.
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    // eslint-disable-next-line no-console
    console.error(
      '[middleware] NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY missing — skipping auth checks for this request',
    );
    return response;
  }

  const supabase = createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet: CookieToSet[]) => {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        toSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  // /admin/* requires auth (excluding the login page itself).
  // Skipped entirely in dev when ADMIN_AUTH_DISABLED is set.
  if (
    !ADMIN_AUTH_DISABLED &&
    path.startsWith('/admin') &&
    path !== ADMIN_LOGIN_PATH &&
    !user
  ) {
    const url = request.nextUrl.clone();
    url.pathname = ADMIN_LOGIN_PATH;
    url.searchParams.set('redirectTo', path);
    return NextResponse.redirect(url);
  }

  // /account/* requires auth (excluding the login page itself)
  if (path.startsWith('/account') && path !== ACCOUNT_LOGIN_PATH && !user) {
    const url = request.nextUrl.clone();
    url.pathname = ACCOUNT_LOGIN_PATH;
    url.searchParams.set('redirectTo', path);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Exclude /api/_env-check from the middleware matcher so the diagnostic
  // endpoint is reachable even when middleware itself can't run (missing
  // env vars, edge-runtime crash, etc.). Routes under /api/* generally
  // don't need session refresh anyway — auth happens via the Bearer token
  // pattern, not Supabase cookies.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/_env-check|.*\\.png$|.*\\.svg$).*)',
  ],
};
