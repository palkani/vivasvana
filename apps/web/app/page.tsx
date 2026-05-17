import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { HeroBanner } from '@/components/storefront/HeroBanner';
import { TrustBadges } from '@/components/storefront/TrustBadges';
import { ProductCard } from '@/components/storefront/ProductCard';
import { api } from '@/lib/api';
import type { ProductListResponse } from '@/lib/types';

export const revalidate = 60; // products list is cached on the edge for 60s

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

export default async function HomePage() {
  const products = await getFeaturedProducts();

  return (
    <>
      <HeroBanner />

      <section className="container py-10">
        <TrustBadges />
      </section>

      <section className="container py-16">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="font-serif text-3xl font-semibold tracking-tight md:text-4xl">
              Shop our blends
            </h2>
            <p className="mt-2 text-muted-foreground">
              Three SKUs. Zero shortcuts. Pick your everyday millet companion.
            </p>
          </div>
          <Button asChild variant="ghost" className="hidden md:inline-flex">
            <Link href="/products">View all →</Link>
          </Button>
        </div>

        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {products.length === 0 ? (
            <p className="col-span-full rounded-lg border bg-muted/40 p-8 text-center text-sm text-muted-foreground">
              Products will appear here once the API is reachable and the database is seeded.
              Run <code className="rounded bg-background px-1.5 py-0.5 font-mono">pnpm db:seed</code>.
            </p>
          ) : (
            products.map((p) => <ProductCard key={p.id} product={p} />)
          )}
        </div>
      </section>

      <section className="bg-muted/40">
        <div className="container py-16">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-serif text-3xl font-semibold tracking-tight">
              Rooted in tradition, made for today
            </h2>
            <p className="mt-4 text-muted-foreground">
              Vivasvana means &ldquo;the radiant one&rdquo; — the Sanskrit name for the sun, source
              of all nourishment. We honor that legacy by sourcing millets directly from Indian
              farmers, blending them with traditional ingredients, and delivering them in clean,
              minimally-processed packs.
            </p>
            <Button asChild className="mt-6">
              <Link href="/about">Read our story</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
