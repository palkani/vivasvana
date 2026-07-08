import type { Metadata } from 'next';
import { ProductCard } from '@/components/storefront/ProductCard';
import { listProducts } from '@/lib/server/storefront-data';
import type { ProductListResponse } from '@/lib/types';
import { ProductsFilterBar } from './_components/ProductsFilterBar';

export const metadata: Metadata = {
  title: 'Shop millet superfoods',
  description: 'Browse Vivasvana plant-based millet blends — Nutri Millet, Millet Mojo, and the Combo Pack.',
};

interface PageProps {
  searchParams: Promise<{
    sort?: string;
    minPrice?: string;
    maxPrice?: string;
    page?: string;
  }>;
}

const VALID_SORTS = ['newest', 'price-asc', 'price-desc', 'bestseller'] as const;
type Sort = (typeof VALID_SORTS)[number];

export default async function ProductsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const sort: Sort = VALID_SORTS.includes(sp.sort as Sort) ? (sp.sort as Sort) : 'newest';
  const page = Math.max(1, Number(sp.page ?? '1') || 1);

  let data: ProductListResponse;
  try {
    data = await listProducts({
      sort,
      page,
      pageSize: 12,
      minPrice: sp.minPrice ? Number(sp.minPrice) : undefined,
      maxPrice: sp.maxPrice ? Number(sp.maxPrice) : undefined,
    });
  } catch {
    data = { items: [], total: 0, page, pageSize: 12 };
  }

  return (
    <div className="container py-10">
      <header className="mb-8 flex flex-col gap-2">
        <h1 className="font-serif text-4xl font-semibold tracking-tight">All products</h1>
        <p className="text-muted-foreground">
          {data.total} {data.total === 1 ? 'product' : 'products'} · free shipping over ₹400
        </p>
      </header>

      <ProductsFilterBar />

      {data.items.length === 0 ? (
        <div className="mt-10 rounded-lg border bg-muted/40 p-12 text-center">
          <p className="text-lg">No products match your filters.</p>
          <p className="mt-2 text-sm text-muted-foreground">Try clearing filters or check back soon.</p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 md:gap-6 lg:grid-cols-4">
          {data.items.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
