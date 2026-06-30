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
    // Wrap the whole detail load in $transaction so pgbouncer keeps
    // every query on the same physical connection for its duration.
    // Without this, an `include` that generates N sub-queries can have
    // each one routed to a different pooled connection, and Prisma's
    // prepared statements race — Postgres errors with
    //   "bind message supplies 4 parameters, but prepared statement
    //    s8 requires 2"
    // ...because `s8` was prepared on a connection that this bind never
    // reaches. The list endpoint accidentally avoided this because it
    // already uses $transaction([count, findMany]).
    //
    // Properly, the operator should also add `?pgbouncer=true&connection_limit=1`
    // to DATABASE_URL to disable Prisma prepared statements at the pool
    // layer — defense in depth. This change holds even if they don't.
    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.findFirst({
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

      // Variants + reviews remain split (one query each, not nested
      // includes) so a transient failure can degrade gracefully via
      // safeRelation — but they now run inside the same transaction,
      // so pgbouncer keeps them on the same connection.
      const variants = await safeRelation(
        () =>
          tx.productVariant.findMany({
            where: { productId: product.id },
            orderBy: { sortOrder: 'asc' },
          }),
        'variants',
        product.id,
      );

      const reviews = await safeRelation(
        () =>
          tx.review.findMany({
            where: { productId: product.id, status: 'APPROVED' },
            orderBy: { createdAt: 'desc' },
            take: 20,
          }),
        'reviews',
        product.id,
      );

      return { ...product, variants, reviews };
    });
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
