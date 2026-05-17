'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Package, ShoppingCart, Users, Tag, FileText, Settings, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';

const nav = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/products', label: 'Products', icon: Package },
  { href: '/admin/orders', label: 'Orders', icon: ShoppingCart },
  { href: '/admin/customers', label: 'Customers', icon: Users },
  { href: '/admin/discounts', label: 'Discounts', icon: Tag },
  { href: '/admin/blog', label: 'Blog', icon: FileText },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
];

interface Props {
  userEmail: string;
  devMode?: boolean;
}

export function AdminSidebar({ userEmail, devMode = false }: Props) {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push('/admin/login');
    router.refresh();
  }

  return (
    <aside className="flex flex-col gap-1 border-r bg-background p-4 md:sticky md:top-0 md:h-screen">
      <div className="mb-4">
        <Link href="/admin" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground font-serif text-lg">
            V
          </div>
          <span className="font-serif text-lg font-semibold">Admin</span>
        </Link>
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/admin' && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition',
                active
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-4 border-t pt-4">
        <p className="truncate px-2 text-xs text-muted-foreground">{userEmail}</p>
        {!devMode && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 w-full justify-start"
            onClick={signOut}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </Button>
        )}
      </div>
    </aside>
  );
}
