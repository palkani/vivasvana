import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { AccountSidebar } from './_components/AccountSidebar';

// Account pages are user-specific and need a live session — never
// prerender them. Without this, build-time Supabase client creation
// throws because env vars aren't available to the build worker.
export const dynamic = 'force-dynamic';

/**
 * Auth gate lives in middleware.ts — unauthenticated visitors to /account/*
 * (except /account/login) are redirected at the edge. By the time this
 * layout renders, middleware has already gated.
 *
 * The login page sits OUTSIDE this layout: it's at app/account/login/
 * while this layout wraps app/account/(authed)/* only. The (authed) route
 * group hides from URLs, so /account, /account/orders, /account/addresses
 * all resolve here without /authed appearing anywhere.
 *
 * If `user` is somehow null here (impossible in normal flow), render a quiet
 * fallback instead of throwing notFound() or redirect() — both surface as
 * console errors in the Next 15 dev overlay.
 */
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="container py-20 text-center">
        <p className="text-muted-foreground">
          You need to be signed in to view this page.{' '}
          <Link href="/account/login" className="text-primary underline">
            Sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="container py-10">
      <div className="grid gap-8 md:grid-cols-[220px_minmax(0,1fr)]">
        <AccountSidebar email={user.email ?? ''} />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
