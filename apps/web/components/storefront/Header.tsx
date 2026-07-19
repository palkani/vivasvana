import Link from 'next/link';
import Image from 'next/image';
import { HeaderActions } from './HeaderActions';

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
          className="flex items-center leading-none"
        >
          <Image
            src="/brand/logo-2026.png"
            alt="Vivasvana — Mindful nourishment made pure"
            width={1363}
            height={855}
            priority
            className="h-14 w-auto md:h-16"
          />
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

        <HeaderActions />
      </div>
    </header>
  );
}
