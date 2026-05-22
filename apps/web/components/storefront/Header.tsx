import Link from 'next/link';
import { ShoppingBag, Search, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SunMark } from './SunMark';

const nav = [
  { href: '/', label: 'Home' },
  { href: '/products', label: 'Products' },
  { href: '/contact', label: 'Contact' },
  { href: '/blog', label: 'Wellness Blog' },
];

export function Header() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-brand-100 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="container flex h-24 items-center justify-between gap-6 md:h-28">
        {/* Hybrid lockup: SVG sun mark (always crisp) + Playfair "Vivasvana"
            wordmark + tagline. The brand PNG is only 60×60, so at desktop
            sizes it pixelated and got visually drowned out by the bold
            green trust strip below. This HTML/SVG version stays sharp at
            any size and gives the wordmark proper weight. */}
        <Link
          href="/"
          aria-label="Vivasvana — Mindful nourishment made pure"
          className="flex items-center gap-3 leading-none"
        >
          <SunMark className="h-12 w-12 shrink-0 md:h-14 md:w-14" />
          <span className="flex flex-col">
            <span className="font-serif text-2xl font-semibold tracking-tight text-brand-700 md:text-3xl">
              Vivasvana
            </span>
            <span className="mt-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground md:text-xs">
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
