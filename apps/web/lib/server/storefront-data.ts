import 'server-only';
import { prisma } from '@vivasvana/db';
import { ProductService } from './services/product.service';
import { BlogService } from './services/blog.service';
import { serializeMoney } from './lib/decimal';
import type { ProductDetail, ProductListResponse } from '@/lib/types';

/**
 * Direct server-side data access for React Server Components.
 *
 * The storefront pages used to `fetch()` their own `/api/*` routes over HTTP
 * (a self-fetch through VERCEL_URL). That hop is fragile on Vercel — it can
 * fail on the internal request even when the public API works, and a thrown
 * fetch crashed the page (e.g. the product detail page white-screened, so the
 * "Add to cart" button never rendered). Reading the DB straight from the RSC
 * is faster and can't fail on an HTTP quirk. Same data as the API routes:
 * each returns exactly `serializeMoney(service result)`.
 *
 * `server-only` makes importing this from a client component a build error.
 */

export interface ProductListArgs {
  page?: number;
  pageSize?: number;
  sort?: 'newest' | 'price-asc' | 'price-desc' | 'bestseller';
  minPrice?: number;
  maxPrice?: number;
  isVegan?: boolean;
  isGlutenFree?: boolean;
  category?: string;
  search?: string;
}

export async function listProducts(args: ProductListArgs = {}): Promise<ProductListResponse> {
  const result = await new ProductService(prisma).list({
    page: args.page ?? 1,
    pageSize: args.pageSize ?? 12,
    sort: args.sort ?? 'newest',
    minPrice: args.minPrice,
    maxPrice: args.maxPrice,
    isVegan: args.isVegan,
    isGlutenFree: args.isGlutenFree,
    category: args.category,
    search: args.search,
    status: 'PUBLISHED',
  });
  return serializeMoney(result) as unknown as ProductListResponse;
}

export async function getProductBySlug(slug: string): Promise<ProductDetail | null> {
  const product = await new ProductService(prisma).getBySlug(slug);
  return product ? (serializeMoney(product) as unknown as ProductDetail) : null;
}

export async function listTestimonials(limit = 6) {
  return prisma.testimonial.findMany({
    where: { status: 'PUBLISHED' },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    take: limit,
  });
}

// Blog return types live locally in the blog pages, so these return the
// serialized service result and the caller casts to its own interface.
export async function listBlog(
  args: { page?: number; pageSize?: number; search?: string } = {},
) {
  const result = await new BlogService(prisma).publicList(args);
  return serializeMoney(result);
}

export async function getBlogPost(slug: string) {
  const post = await new BlogService(prisma).publicGet(slug);
  return post ? serializeMoney(post) : null;
}