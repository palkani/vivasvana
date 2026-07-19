import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { LoginForm } from './_components/LoginForm';

export const metadata: Metadata = {
  title: 'Admin login',
  robots: { index: false, follow: false },
};

// Reads searchParams and calls Supabase server client — both incompatible
// with build-time prerender on Vercel where env vars aren't injected yet.
export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ redirectTo?: string; timeout?: string }>;
}

const ADMIN_AUTH_DISABLED =
  process.env.NODE_ENV !== 'production' &&
  process.env.NEXT_PUBLIC_ADMIN_AUTH_DISABLED === 'true';

export default async function AdminLoginPage({ searchParams }: PageProps) {
  const { redirectTo = '/admin', timeout } = await searchParams;

  // Dev bypass: admin auth is off → no point in showing a login form.
  if (ADMIN_AUTH_DISABLED) {
    return (
      <div className="container flex min-h-[60vh] items-center justify-center py-12">
        <div className="w-full max-w-sm rounded-lg border bg-card p-8 text-center">
          <h1 className="font-serif text-xl font-semibold">Admin auth is disabled (dev)</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            <code className="font-mono">ADMIN_AUTH_DISABLED=true</code> in .env. Skip login and
            head straight in.
          </p>
          <Button asChild className="mt-6 w-full">
            <Link href={redirectTo}>Open admin →</Link>
          </Button>
        </div>
      </div>
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Already signed in — quiet "continue" card instead of redirect()
  // (which throws NEXT_REDIRECT in the dev overlay).
  if (user) {
    return (
      <div className="container flex min-h-[60vh] items-center justify-center py-12">
        <div className="w-full max-w-sm rounded-lg border bg-card p-8 text-center">
          <h1 className="font-serif text-xl font-semibold">You&rsquo;re already signed in</h1>
          <p className="mt-2 text-sm text-muted-foreground">{user.email}</p>
          <Button asChild className="mt-6 w-full">
            <Link href={redirectTo}>Open admin →</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container flex min-h-[60vh] items-center justify-center py-12">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="font-serif text-2xl font-semibold">Admin login</h1>
          <p className="text-sm text-muted-foreground">Sign in with your admin account</p>
        </div>
        {timeout && (
          <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-center text-sm text-amber-800">
            You were signed out due to inactivity. Please sign in again.
          </p>
        )}
        <LoginForm redirectTo={redirectTo} />
      </div>
    </div>
  );
}
