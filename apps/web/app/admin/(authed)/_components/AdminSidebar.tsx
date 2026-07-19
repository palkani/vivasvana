'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Package,
  Boxes,
  FolderTree,
  ShoppingCart,
  Users,
  Tag,
  FileText,
  Star,
  MessageSquareQuote,
  Settings,
  LogOut,
  BarChart3,
  UserCog,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { useAdminMe } from './AdminMeProvider';
import type { Permission } from '@/lib/admin-permissions';

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  /** Any one of these is enough to show the link. */
  permissions: Permission[];
}

const NAV: NavItem[] = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, permissions: ['view_dashboard'] },
  { href: '/admin/reports', label: 'Reports', icon: BarChart3, permissions: ['view_reports'] },
  { href: '/admin/products', label: 'Products', icon: Package, permissions: ['view_products', 'manage_products'] },
  { href: '/admin/inventory', label: 'Inventory', icon: Boxes, permissions: ['view_products', 'manage_products'] },
  { href: '/admin/categories', label: 'Categories', icon: FolderTree, permissions: ['view_products', 'manage_products'] },
  { href: '/admin/orders', label: 'Orders', icon: ShoppingCart, permissions: ['view_orders', 'manage_orders'] },
  { href: '/admin/customers', label: 'Customers', icon: Users, permissions: ['view_customers', 'manage_customers'] },
  { href: '/admin/discounts', label: 'Discounts', icon: Tag, permissions: ['view_discounts', 'manage_discounts'] },
  { href: '/admin/reviews', label: 'Reviews', icon: Star, permissions: ['view_blog', 'manage_blog'] },
  { href: '/admin/blog', label: 'Blog', icon: FileText, permissions: ['view_blog', 'manage_blog'] },
  { href: '/admin/testimonials', label: 'Testimonials', icon: MessageSquareQuote, permissions: ['view_blog', 'manage_blog'] },
  { href: '/admin/staff', label: 'Staff', icon: UserCog, permissions: ['manage_staff'] },
  { href: '/admin/settings', label: 'Settings', icon: Settings, permissions: ['manage_settings'] },
];

interface Props {
  userEmail: string;
  devMode?: boolean;
}

export function AdminSidebar({ userEmail, devMode = false }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const { me, loading } = useAdminMe();

  async function signOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push('/admin/login');
    router.refresh();
  }

  // Until /me responds, show all items in a low-opacity placeholder state so
  // the layout doesn't jump. Once loaded, filter strictly.
  const visible = loading
    ? NAV
    : NAV.filter((item) =>
        item.permissions.some((p) => me?.permissions.includes(p)),
      );

  return (
    <aside className="flex flex-col gap-1 border-r bg-background p-4 md:sticky md:top-0 md:h-screen">
      <div className="mb-4">
        <Link href="/admin" className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-2026.png" alt="Vivasvana" className="h-8 w-auto" />
          <span className="font-serif text-lg font-semibold">Admin</span>
        </Link>
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {visible.map(({ href, label, icon: Icon }) => {
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
                loading && 'opacity-60',
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-4 border-t pt-4">
        <p className="truncate px-2 text-xs font-medium">{me?.name ?? userEmail}</p>
        <p className="truncate px-2 text-[10px] uppercase tracking-wide text-muted-foreground">
          {me?.roleLabel ?? (loading ? '…' : 'Staff')}
        </p>
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
