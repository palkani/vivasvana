import { notFound } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { AdminSidebar } from './_components/AdminSidebar';

/**
 * Auth gate for /admin/* lives in middleware.ts. By the time this layout
 * renders we are guaranteed a user. notFound() as defensive fallback —
 * cleaner than redirect() inside a layout (no NEXT_REDIRECT dev overlay).
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) notFound();

  return (
    <div className="grid min-h-screen grid-cols-1 md:grid-cols-[240px_1fr]">
      <AdminSidebar userEmail={user.email ?? ''} />
      <main className="bg-muted/30 p-4 md:p-8">{children}</main>
    </div>
  );
}
