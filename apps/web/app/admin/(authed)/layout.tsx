import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { AdminSidebar } from './_components/AdminSidebar';
import { DevAuthBanner } from './_components/DevAuthBanner';
import { AdminMeProvider } from './_components/AdminMeProvider';

// Admin pages need a live Supabase session check — prerendering them at
// build time would call createSupabaseServerClient() before env vars are
// available, killing the build. Render at request time instead.
export const dynamic = 'force-dynamic';

const ADMIN_AUTH_DISABLED =
  process.env.NODE_ENV !== 'production' &&
  process.env.NEXT_PUBLIC_ADMIN_AUTH_DISABLED === 'true';

/**
 * Auth gate lives in middleware.ts. /admin/login sits OUTSIDE this layout.
 *
 * Dev bypass: when ADMIN_AUTH_DISABLED is set (and non-prod), skip the
 * Supabase call entirely and render the admin shell with a stub identity
 * plus a visible warning banner so the bypass is never invisible.
 *
 * Permission gating: AdminMeProvider fetches /api/admin/me on mount; the
 * sidebar hides nav items the user lacks permission for, and individual
 * pages can use useAdminMe() / can() for finer control. Server-side
 * enforcement still lives in the API.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (ADMIN_AUTH_DISABLED) {
    return (
      <AdminMeProvider>
        <div className="grid min-h-screen grid-cols-1 md:grid-cols-[240px_minmax(0,1fr)]">
          <AdminSidebar userEmail="dev@local (auth disabled)" devMode />
          <main className="min-w-0 bg-muted/30">
            <DevAuthBanner />
            <div className="p-4 md:p-8">{children}</div>
          </main>
        </div>
      </AdminMeProvider>
    );
  }

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
    <AdminMeProvider>
      <div className="grid min-h-screen grid-cols-1 md:grid-cols-[240px_1fr]">
        <AdminSidebar userEmail={user.email ?? ''} />
        <main className="min-w-0 bg-muted/30 p-4 md:p-8">{children}</main>
      </div>
    </AdminMeProvider>
  );
}
