import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { AuthForm } from './_components/AuthForm';

export const metadata: Metadata = {
  title: 'Sign in or create an account',
  robots: { index: false, follow: false },
};

// Calls Supabase server client to check existing session — never prerender.
export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ redirectTo?: string }>;
}

export default async function CustomerLoginPage({ searchParams }: PageProps) {
  const { redirectTo = '/account' } = await searchParams;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Already signed in — render a friendly "continue" card instead of
  // redirect()ing. redirect() from RSC throws NEXT_REDIRECT and surfaces
  // in the Next 15 dev overlay. Inline render is quiet.
  if (user) {
    return (
      <div className="container flex min-h-[60vh] items-center justify-center py-12">
        <div className="w-full max-w-sm rounded-lg border bg-card p-8 text-center">
          <h1 className="font-serif text-xl font-semibold">You&rsquo;re already signed in</h1>
          <p className="mt-2 text-sm text-muted-foreground">{user.email}</p>
          <Button asChild className="mt-6 w-full">
            <Link href={redirectTo}>Continue →</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container flex min-h-[60vh] items-center justify-center py-12">
      <div className="w-full max-w-sm">
        <AuthForm redirectTo={redirectTo} />
      </div>
    </div>
  );
}
