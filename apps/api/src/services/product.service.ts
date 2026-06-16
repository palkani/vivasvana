import type { PrismaClient, Prisma } from '@vivasvana/db';

/**
 * Wrap a relation lookup so a transient DB error (pgbouncer race,
 * replica lag, etc.) yields an empty list instead of taking the whole
 * product page down. Logs to stderr with a tag so Railway log search
 * still surfaces the underlying error.
 */
async function safeRelation<T>(
  fn: () => Promise<T[]>,
  name: string,
  productId: string,
): Promise<T[]> {
  try {
    return await fn();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console
    console.warn(
      `[product.service] relation "${name}" failed for product ${productId} — degrading to []: ${msg}`,
    );
    return [];
  }
}

export interface ListProductsArgs {
  page: number;
  pageSize: number;
  sort: 'newest' | 'price-asc' | 'price-desc' | 'bestseller';
  minPrice?: number;
  maxPrice?: number;
  isVegan?: boolean;
  isGlutenFree?: boolean;
  category?: string; // slug
  search?: string;
  status?: 'PUBLISHED' | 'DRAFT' | 'ARCHIVED';
}

const ORDER_BY: Record<ListProductsArgs['sort'], Prisma.ProductOrderByWithRelationInput[]> = {
  newest: [{ createdAt: 'desc' }],
  'price-asc': [{ price: 'asc' }],
  'price-desc': [{ price: 'desc' }],
  // Bestseller: proxy by order count until we materialize a metric (Phase 3).
  bestseller: [{ createdAt: 'desc' }],
};

export class ProductService {
  constructor(private readonly prisma: PrismaClient) {}

  async list(args: ListProductsArgs) {
    const where: Prisma.ProductWhereInput = {
      deletedAt: null,
      status: args.status ?? 'PUBLISHED',
    };

    if (args.minPrice !== undefined || args.maxPrice !== undefined) {
      where.price = {
        gte: args.minPrice,
        lte: args.maxPrice,
      };
    }
    if (args.isVegan !== undefined) where.isVegan = args.isVegan;
    if (args.isGlutenFree !== undefined) where.isGlutenFree = args.isGlutenFree;
    if (args.category) {
      where.categories = { some: { category: { slug: args.category } } };
    }
    if (args.search) {
      where.OR = [
        { title: { contains: args.search, mode: 'insensitive' } },
        { description: { contains: args.search, mode: 'insensitive' } },
        { ingredients: { contains: args.search, mode: 'insensitive' } },
      ];
    }

    const [total, items] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        orderBy: ORDER_BY[args.sort],
        skip: (args.page - 1) * args.pageSize,
        take: args.pageSize,
        include: {
          images: { orderBy: { sortOrder: 'asc' }, take: 1 },
          categories: { include: { category: true } },
        },
      }),
    ]);

    return { total, items, page: args.page, pageSize: args.pageSize };
  }

  async getBySlug(slug: string, includeUnpublished = false) {
    // Core: product + the relations the page genuinely cannot render
    // without (images, categories). If THIS query fails, the page must
    // 500 — there's no graceful fallback.
    const product = await this.prisma.product.findFirst({
      where: {
        slug,
        deletedAt: null,
        ...(includeUnpublished ? {} : { status: 'PUBLISHED' }),
      },
      include: {
        images: { orderBy: { sortOrder: 'asc' } },
        categories: { include: { category: true } },
      },
    });
    if (!product) return null;

    // Optional relations: split into separate queries so a flaky one
    // (e.g. pgbouncer prepared-statement race on a deeper include, or
    // a future relation that hits a permissions issue) doesn't take
    // the whole product page down. Each one degrades to an empty
    // array with a warn-level log so we still see breakage in Railway
    // without losing the page to users.
    const variants = await safeRelation(
      () =>
        this.prisma.productVariant.findMany({
          where: { productId: product.id },
          orderBy: { sortOrder: 'asc' },
        }),
      'variants',
      product.id,
    );

    const reviews = await safeRelation(
      () =>
        this.prisma.review.findMany({
          where: { productId: product.id, status: 'APPROVED' },
          orderBy: { createdAt: 'desc' },
          take: 20,
        }),
      'reviews',
      product.id,
    );

    return { ...product, variants, reviews };
  }

  async create(input: Prisma.ProductCreateInput) {
    return this.prisma.product.create({ data: input, include: { images: true } });
  }

  async update(id: string, input: Prisma.ProductUpdateInput) {
    return this.prisma.product.update({ where: { id }, data: input, include: { images: true } });
  }

  async softDelete(id: string) {
    return this.prisma.product.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'ARCHIVED' },
    });
  }
}
