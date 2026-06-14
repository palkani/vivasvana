import type { Metadata, Viewport } from 'next';
import { Inter, Fraunces } from 'next/font/google';
import './globals.css';
import { Header } from '@/components/storefront/Header';
import { Footer } from '@/components/storefront/Footer';
import { TrustStrip } from '@/components/storefront/TrustStrip';
import { cn } from '@/lib/utils';

// Body: Inter — humanist sans, hyper-legible at body sizes, the proven
// workhorse for ecommerce. Keep `cv11` (alternate single-storey g) off
// because it can look "techy" against a warm food brand voice.
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

// Display: Fraunces — a variable serif with `opsz` (optical sizing) and
// `SOFT` axes. At hero size it reads warm and editorial (think: Bon Appétit,
// Outdoor Voices, premium DTC food). At product-title size the same family
// stays elegant without screaming for attention.
//
// We omit a static weight array on purpose: declaring `weight: [...]` pulls
// the static cuts and forbids variable axes, but we want the SOFT axis to
// stay live so the CSS in globals.css can dial it per heading scale.
const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-serif',
  display: 'swap',
  // opsz auto-applies based on font-size; SOFT we tune via font-variation-
  // settings in globals.css for per-element warmth control.
  axes: ['SOFT'],
});

export const metadata: Metadata = {
  title: {
    default: 'Vivasvana — Plant-based millet superfoods',
    template: '%s · Vivasvana',
  },
  description:
    'FSSAI certified millet nutrition blends from Vivasvana — plant-based, no refined sugar, made in India.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    siteName: 'Vivasvana',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#bf8b3a',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn(inter.variable, fraunces.variable)}>
      <body className="flex min-h-screen flex-col font-sans">
        <Header />
        <TrustStrip />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
