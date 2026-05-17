import { notFound } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { AccountSidebar } from './_components/AccountSidebar';

/**
 * Auth gate for /account/* lives in middleware.ts — unauthenticated visitors
 * are bounced to /account/login at the edge. By the time this layout renders
 * we are guaranteed a user. We still call notFound() as a defensive fallback
 * (cleaner than redirect() inside a layout; doesn't throw NEXT_REDIRECT in
 * the dev overlay).
 */
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Middleware should have already redirected. If we're here, something's off.
    notFound();
  }

  return (
    <div className="container py-10">
      <div className="grid gap-8 md:grid-cols-[220px_1fr]">
        <AccountSidebar email={user.email ?? ''} />
        <div>{children}</div>
      </div>
    </div>
  );
}
