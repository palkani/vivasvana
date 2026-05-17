import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { AdminSidebar } from './_components/AdminSidebar';

/**
 * Auth gate lives in middleware.ts. /admin/login sits OUTSIDE this layout
 * (it's at app/admin/login while this wraps app/admin/(authed)/*) so a
 * logged-out visitor can reach the login page without tripping this guard.
 *
 * Graceful fallback when user is null — no throw → no dev overlay error.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="container py-20 text-center">
        <p className="text-muted-foreground">
          Admin access requires sign-in.{' '}
          <Link href="/admin/login" className="text-primary underline">
            Sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="grid min-h-screen grid-cols-1 md:grid-cols-[240px_1fr]">
      <AdminSidebar userEmail={user.email ?? ''} />
      <main className="bg-muted/30 p-4 md:p-8">{children}</main>
    </div>
  );
}
