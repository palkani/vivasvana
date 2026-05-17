import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { AdminSidebar } from './_components/AdminSidebar';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware redirects /admin/* → /admin/login when unauthenticated,
  // but /admin/login itself doesn't render this layout (it's at /admin/login
  // and uses no layout). This guard is belt-and-braces.
  if (!user) redirect('/admin/login');

  return (
    <div className="grid min-h-screen grid-cols-1 md:grid-cols-[240px_1fr]">
      <AdminSidebar userEmail={user.email ?? ''} />
      <main className="bg-muted/30 p-4 md:p-8">{children}</main>
    </div>
  );
}
