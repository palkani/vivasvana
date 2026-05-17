import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { LoginForm } from './_components/LoginForm';

export const metadata: Metadata = {
  title: 'Admin login',
  robots: { index: false, follow: false },
};

interface PageProps {
  searchParams: Promise<{ redirectTo?: string }>;
}

export default async function AdminLoginPage({ searchParams }: PageProps) {
  const { redirectTo = '/admin' } = await searchParams;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect(redirectTo);

  return (
    <div className="container flex min-h-[60vh] items-center justify-center py-12">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="font-serif text-2xl font-semibold">Admin login</h1>
          <p className="text-sm text-muted-foreground">Sign in with your admin account</p>
        </div>
        <LoginForm redirectTo={redirectTo} />
      </div>
    </div>
  );
}
