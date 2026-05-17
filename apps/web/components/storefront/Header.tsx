import Link from 'next/link';
import { ShoppingBag, Search, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SunMark } from './SunMark';

const nav = [
  { href: '/', label: 'Home' },
  { href: '/products', label: 'Catalog' },
  { href: '/contact', label: 'Contact' },
  { href: '/blog', label: 'Wellness Blog' },
];

export function Header() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-brand-100 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="container flex h-20 items-center justify-between gap-6">
        <Link href="/" className="flex items-center gap-3" aria-label="Vivasvana home">
          <SunMark className="h-10 w-10 shrink-0" />
          <span className="flex flex-col leading-tight">
            <span className="font-serif text-2xl font-semibold tracking-tight text-brand-700">
              Vivasvana
            </span>
            <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Mindful nourishment made pure
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex" aria-label="Primary">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-foreground/80 transition-colors hover:text-brand-700"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" aria-label="Search">
            <Search className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Account" asChild>
            <Link href="/account">
              <User className="h-5 w-5" />
            </Link>
          </Button>
          <Button variant="ghost" size="icon" aria-label="Cart" asChild>
            <Link href="/cart">
              <ShoppingBag className="h-5 w-5" />
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
