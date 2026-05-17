import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { AuthForm } from './_components/AuthForm';

export const metadata: Metadata = {
  title: 'Sign in or create an account',
  robots: { index: false, follow: false },
};

interface PageProps {
  searchParams: Promise<{ redirectTo?: string }>;
}

export default async function CustomerLoginPage({ searchParams }: PageProps) {
  const { redirectTo = '/account' } = await searchParams;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect(redirectTo);

  return (
    <div className="container flex min-h-[60vh] items-center justify-center py-12">
      <div className="w-full max-w-sm">
        <AuthForm redirectTo={redirectTo} />
      </div>
    </div>
  );
}
