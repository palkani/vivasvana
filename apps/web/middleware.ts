import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { env } from '@/lib/env';

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

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  // /admin/* requires auth (excluding the login page itself)
  if (path.startsWith('/admin') && path !== ADMIN_LOGIN_PATH && !user) {
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
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.svg$).*)'],
};
