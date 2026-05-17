import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { AccountSidebar } from './_components/AccountSidebar';

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/account/login?redirectTo=/account');
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
