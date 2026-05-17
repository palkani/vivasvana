'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Package, MapPin, User, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

const nav = [
  { href: '/account', label: 'Overview', icon: User },
  { href: '/account/orders', label: 'Orders', icon: Package },
  { href: '/account/addresses', label: 'Addresses', icon: MapPin },
];

export function AccountSidebar({ email }: { email: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  }

  return (
    <aside className="flex flex-col gap-1 rounded-lg border bg-card p-4">
      <p className="px-2 pb-2 text-xs text-muted-foreground">{email}</p>
      {nav.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || (href !== '/account' && pathname.startsWith(href));
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
      <Button variant="ghost" size="sm" className="mt-2 justify-start" onClick={signOut}>
        <LogOut className="mr-2 h-4 w-4" />
        Sign out
      </Button>
    </aside>
  );
}
