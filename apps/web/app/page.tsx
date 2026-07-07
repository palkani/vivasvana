import Link from 'next/link';
import {
  Sparkles,
  Sun,
  Leaf,
  ShieldCheck,
  MapPin,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { HeroBanner } from '@/components/storefront/HeroBanner';
import { ProductCard } from '@/components/storefront/ProductCard';
import { TestimonialsRow, type Testimonial } from '@/components/storefront/TestimonialsRow';
import { NewsletterBand } from '@/components/storefront/NewsletterBand';
import { api } from '@/lib/api';
import type { ProductListResponse } from '@/lib/types';

// Render at request time, not at build. Prerendering at build needed the
// API to be reachable from the Vercel build runner — when it wasn't
// (env misconfig or Railway unreachable from CI's network), every page
// build worker hung on the fetch and Next.js killed the build at its
// 60s deadline. Request-time rendering moves that to a runtime cache
// miss, where the env IS configured and the API IS reachable.
export const dynamic = 'force-dynamic';
export const revalidate = 60;

async function getFeaturedProducts() {
  // The API is now served by this same app's route handlers and the page is
  // force-dynamic, so we always fetch at request time. The try/catch keeps the
  // page rendering even if the call fails.
  try {
    const res = await api.get<ProductListResponse>('/api/products?pageSize=3', {
      next: { revalidate: 60 },
    });
    // Defensive: never return a non-array. If the API is unreachable or a
    // proxy/edge layer hands back a non-JSON body, `res?.items` can be
    // undefined — returning it would crash the page on `.slice`/`.map`.
    return Array.isArray(res?.items) ? res.items : [];
  } catch (err) {
    console.error('Failed to load featured products', err);
    return [];
  }
}

async function getTestimonials(): Promise<Testimonial[]> {
  try {
    const res = await api.get<{ items: Testimonial[] }>('/api/testimonials?limit=3', {
      next: { revalidate: 300 },
    });
    return Array.isArray(res?.items) ? res.items : [];
  } catch {
    return [];
  }
}

const PILLARS = [
  {
    icon: Sun,
    title: 'Ancient Wisdom',
    body:
      'Crafted from 6+ ancient Indian millets used for thousands of years in traditional Indian nutrition.',
  },
  {
    icon: Leaf,
    title: 'Clean Label Promise',
    body:
      'Zero artificial colours, flavours, preservatives or added sugar. Always real, never artificial.',
  },
  {
    icon: ShieldCheck,
    title: 'FSSAI Certified',
    body:
      "Licensed by FSSAI under India's highest food safety standards. Lab-tested for quality every batch.",
  },
  {
    icon: MapPin,
    title: 'Proudly Made in India',
    body:
      'Farmer-rooted ingredients, recyclable packaging, and a commitment to sustainable Indian agriculture.',
  },
];

export default async function HomePage() {
  const [products, testimonials] = await Promise.all([getFeaturedProducts(), getTestimonials()]);

  const heroImages = (products ?? [])
    .slice(0, 2)
    .map((p) => ({
      url: p.images?.[0]?.url ?? '',
      alt: p.title ?? '',
      slug: p.slug ?? '',
    }))
    .filter((p) => p.url);

  return (
    <>
      <HeroBanner productImages={heroImages} />

      {/* Featured products */}
      <section className="container py-16 md:py-20">
        <header className="mx-auto max-w-2xl text-center">
          <p className="inline-flex items-center gap-2 rounded-full bg-brand-100 px-3 py-1 text-xs font-medium uppercase tracking-wider text-brand-800">
            <Sparkles className="h-3.5 w-3.5" aria-hidden /> Hand-crafted in India
          </p>
          <h2 className="mt-4 font-serif text-3xl font-semibold tracking-tight text-brand-900 md:text-4xl">
            Shop our blends
          </h2>
          <p className="mt-3 text-muted-foreground">
            Three SKUs. Zero shortcuts. Pick the millet companion that fits your lifestyle.
          </p>
        </header>

        <div className="mx-auto mt-10 grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {products.length === 0 ? (
            <p className="col-span-full rounded-lg border bg-muted/40 p-8 text-center text-sm text-muted-foreground">
              Products will appear here once the database is seeded.{' '}
              Run <code className="rounded bg-background px-1.5 py-0.5 font-mono">pnpm db:seed</code>.
            </p>
          ) : (
            products.map((p) => <ProductCard key={p.id} product={p} />)
          )}
        </div>

        <div className="mt-8 text-center">
          <Button asChild variant="outline" size="lg">
            <Link href="/products">View all products →</Link>
          </Button>
        </div>
      </section>

      {/* Brand story — mirrors vivasvana.com "About Vivasvana" section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-leaf-500/10 via-background to-brand-100/40">
        <div className="container grid items-start gap-12 py-16 md:py-20 lg:grid-cols-2">
          <div className="space-y-5">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-brand-600">
              About Vivasvana
            </p>
            <h2 className="font-serif text-3xl font-semibold leading-tight tracking-tight text-brand-900 md:text-4xl">
              Born of sunlight,<br />built for daily strength
            </h2>
            <p className="text-sm font-medium text-brand-700">Mindful Nourishment Made Pure</p>
            <p className="text-foreground/80">
              Vivasvana draws its name from the ancient Sanskrit word for the Sun — a symbol of
              energy, vitality and life. Inspired by India&rsquo;s rich tradition of plant-based
              nutrition and guided by the <em>Sapta Dhatu</em> philosophy of nourishing all seven
              vital tissues, we craft every product to fuel your body from the inside out.
            </p>
            <p className="text-foreground/80">
              True nutrition comes from the earth — from farmer-rooted, minimally processed ancient
              Indian superfoods like millets, pulses, nuts and digestive herbs. Clean-label,
              preservative-free, 100% vegan.
            </p>
            <p className="pt-2 font-serif text-lg italic text-brand-600">
              Nourishing India, one ancient grain at a time.
            </p>
          </div>

          <ul className="grid gap-4 sm:grid-cols-2">
            {PILLARS.map(({ icon: Icon, title, body }) => (
              <li
                key={title}
                className="rounded-2xl border border-brand-100 bg-card p-5 shadow-sm transition hover:shadow-md"
              >
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-brand-700">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <h3 className="mt-4 font-serif text-base font-semibold text-brand-900">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Testimonials */}
      <TestimonialsRow testimonials={testimonials} />

      {/* Newsletter */}
      <NewsletterBand />
    </>
  );
}
