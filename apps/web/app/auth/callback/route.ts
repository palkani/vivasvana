import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@vivasvana/db';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { CartService } from '@/lib/server/services/cart.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Shared OAuth / email-link callback.
 *
 * Supabase redirects here with a `?code=` after:
 *   - Google (and any OAuth) sign-in
 *   - a password-recovery email link  (→ next=/account/reset-password)
 *   - a magic-link email (if enabled)
 *
 * We exchange the code for a session (sets the auth cookie), mirror the user
 * into our domain `User` table (so FKs resolve), merge any guest cart, then
 * redirect to `next` (validated to a local path).
 */
function safeNext(next: string | null): string {
  // Only allow same-site absolute paths — never an open redirect.
  if (next && next.startsWith('/') && !next.startsWith('//')) return next;
  return '/account';
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const next = safeNext(url.searchParams.get('next'));

  if (!code) {
    return NextResponse.redirect(`${url.origin}/account/login?error=missing_code`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error('[auth/callback] exchangeCodeForSession failed', error.message);
    return NextResponse.redirect(`${url.origin}/account/login?error=auth`);
  }

  // Post-login: mirror the user + merge the guest cart. Best-effort — a
  // failure here must never block the user from landing signed-in.
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await prisma.user.upsert({
        where: { id: user.id },
        update: {},
        create: {
          id: user.id,
          email: user.email ?? `${user.id}@user.local`,
          name: (user.user_metadata?.name as string | undefined) ?? null,
          role: 'CUSTOMER',
        },
      });
      const jar = await cookies();
      const sid = jar.get('vv_cart_sid')?.value;
      if (sid) {
        await new CartService(prisma).mergeGuestIntoUser({ userId: user.id, sessionId: sid });
      }
    }
  } catch (e) {
    console.error('[auth/callback] post-login step failed', e);
  }

  return NextResponse.redirect(`${url.origin}${next}`);
}
