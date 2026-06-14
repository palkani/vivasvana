import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { api } from '@/lib/api';

/**
 * OAuth (PKCE) + email-magic-link callback.
 *
 * Supabase Auth redirects the browser here with `?code=…&next=…` after a
 * social login completes (Google, GitHub, etc.). The PKCE code verifier
 * is stored in the auth cookie that came back with the OAuth roundtrip,
 * so we just exchange the code for a session server-side and bounce the
 * shopper onward.
 *
 * `next` is preserved end-to-end so the original "redirectTo" the shopper
 * was trying to reach (e.g. /checkout) is honoured after they sign in.
 *
 * We also merge any guest cart attached to the session cookie into the
 * newly-authenticated user account — same cart-continuity contract as
 * the password-based AuthForm.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') ?? '/account';
  // Supabase can redirect with `?error=…` if the provider rejected the
  // login (consent denied, popup closed, etc.). Surface that on the login
  // page rather than 500.
  const errorParam = url.searchParams.get('error_description') ?? url.searchParams.get('error');

  if (errorParam) {
    const loginUrl = new URL('/account/login', url.origin);
    loginUrl.searchParams.set('oauth_error', errorParam);
    return NextResponse.redirect(loginUrl);
  }

  if (!code) {
    // Direct hits to /auth/callback without a code are noise — bounce to
    // the login page so the shopper isn't stuck on a blank URL.
    return NextResponse.redirect(new URL('/account/login', url.origin));
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.session) {
    const loginUrl = new URL('/account/login', url.origin);
    loginUrl.searchParams.set(
      'oauth_error',
      error?.message ?? 'Could not complete sign-in. Please try again.',
    );
    return NextResponse.redirect(loginUrl);
  }

  // Best-effort guest-cart merge so a shopper who added items as a guest
  // doesn't lose them on first sign-in. Non-fatal: if the API is down or
  // the cookie is missing we just continue.
  try {
    const sessionId = request.cookies.get('vv_cart_sid')?.value;
    if (sessionId) {
      await api.post(
        '/api/cart/merge',
        { sessionId },
        { accessToken: data.session.access_token },
      );
    }
  } catch {
    // ignore — cart preserved client-side, user can merge manually
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
