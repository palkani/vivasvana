import type { PrismaClient, Prisma } from '@vivasvana/db';

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
    const product = await this.prisma.product.findFirst({
      where: {
        slug,
        deletedAt: null,
        ...(includeUnpublished ? {} : { status: 'PUBLISHED' }),
      },
      include: {
        images: { orderBy: { sortOrder: 'asc' } },
        variants: { orderBy: { sortOrder: 'asc' } },
        categories: { include: { category: true } },
        reviews: {
          where: { status: 'APPROVED' },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });
    return product;
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
