import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { HeroBanner } from '@/components/storefront/HeroBanner';
import { ProductCard } from '@/components/storefront/ProductCard';
import { TestimonialsRow, type Testimonial } from '@/components/storefront/TestimonialsRow';
import { NewsletterBand } from '@/components/storefront/NewsletterBand';
import { api } from '@/lib/api';
import type { ProductListResponse } from '@/lib/types';

export const revalidate = 60;

async function getFeaturedProducts() {
  try {
    const res = await api.get<ProductListResponse>('/api/products?pageSize=3', {
      next: { revalidate: 60 },
    });
    return res.items;
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
    return res.items;
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const [products, testimonials] = await Promise.all([getFeaturedProducts(), getTestimonials()]);

  const heroImages = products
    .slice(0, 2)
    .map((p) => ({
      url: p.images[0]?.url ?? '',
      alt: p.title,
      slug: p.slug,
    }))
    .filter((p) => p.url);

  return (
    <>
      <HeroBanner productImages={heroImages} />

      {/* Featured products */}
      <section className="container py-20">
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
              Products will appear here once the API is reachable and the database is seeded.
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

      {/* Brand story */}
      <section className="relative overflow-hidden bg-gradient-to-br from-leaf-500/10 via-background to-brand-100/30">
        <div className="container grid items-center gap-12 py-20 md:grid-cols-2">
          <div className="space-y-5">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-brand-600">
              Our story
            </p>
            <h2 className="font-serif text-3xl font-semibold tracking-tight text-brand-900 md:text-4xl">
              Rooted in tradition,<br />made for today
            </h2>
            <p className="text-foreground/80">
              Vivasvana means <em>the radiant one</em> — the Sanskrit name for the sun, source of all
              nourishment. We honor that legacy by sourcing millets directly from Indian farmers,
              blending them with traditional ingredients, and delivering them in clean,
              minimally-processed packs.
            </p>
            <p className="text-foreground/80">
              No refined sugar. No preservatives. Just ancient grains, ready for modern kitchens.
            </p>
            <Button asChild>
              <Link href="/about">Read our full story</Link>
            </Button>
          </div>

          <ul className="grid grid-cols-2 gap-4">
            {[
              { stat: '7', label: 'Ancient millets in every pack' },
              { stat: '0g', label: 'Refined sugar added' },
              { stat: '5★', label: 'Average customer rating' },
              { stat: '1000+', label: 'Indian families served' },
            ].map((m) => (
              <li
                key={m.label}
                className="rounded-2xl border border-brand-100 bg-card p-6 text-center shadow-sm"
              >
                <p className="font-serif text-4xl font-semibold text-brand-700">{m.stat}</p>
                <p className="mt-2 text-xs uppercase tracking-wider text-muted-foreground">
                  {m.label}
                </p>
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
