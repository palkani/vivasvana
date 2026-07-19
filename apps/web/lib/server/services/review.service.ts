import type { PrismaClient, Prisma, ReviewStatus } from '@vivasvana/db';

/**
 * Customer product reviews.
 *
 * Public surface: shoppers read APPROVED reviews (with an aggregate rating
 * summary) and submit new ones, which land as PENDING for moderation. Admin
 * surface: a moderation queue to approve/reject/delete.
 */

export interface ReviewAggregate {
  average: number; // rounded to 1 decimal, 0 when no approved reviews
  count: number;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
}

export interface SubmitReviewInput {
  productId: string;
  userId?: string | null;
  authorName: string;
  rating: number;
  title?: string | null;
  content: string;
}

const VERIFIED_ORDER_STATUSES = ['DELIVERED', 'CONFIRMED'] as const;

export class ReviewService {
  constructor(private readonly prisma: PrismaClient) {}

  /** Approved reviews for a product plus an aggregate rating summary. */
  async listApprovedForProduct(productId: string) {
    const [reviews, grouped] = await Promise.all([
      this.prisma.review.findMany({
        where: { productId, status: 'APPROVED' },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          authorName: true,
          rating: true,
          title: true,
          content: true,
          isVerifiedPurchase: true,
          createdAt: true,
        },
      }),
      this.prisma.review.groupBy({
        by: ['rating'],
        where: { productId, status: 'APPROVED' },
        _count: { _all: true },
      }),
    ]);

    const distribution: ReviewAggregate['distribution'] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let sum = 0;
    let count = 0;
    for (const g of grouped) {
      const r = g.rating as 1 | 2 | 3 | 4 | 5;
      const n = g._count._all;
      if (r >= 1 && r <= 5) distribution[r] = n;
      sum += r * n;
      count += n;
    }
    const average = count > 0 ? Math.round((sum / count) * 10) / 10 : 0;

    return {
      reviews,
      aggregate: { average, count, distribution } satisfies ReviewAggregate,
    };
  }

  /**
   * Create a PENDING review. Marks isVerifiedPurchase=true when the reviewer
   * (matched by userId, or by the email on a past order) has a DELIVERED or
   * CONFIRMED order that contains this product.
   */
  async submit(input: SubmitReviewInput) {
    const rating = Math.trunc(input.rating);
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      throw new Error('INVALID_RATING');
    }
    const content = input.content.trim();
    if (content.length < 10) throw new Error('CONTENT_TOO_SHORT');
    if (content.length > 5000) throw new Error('CONTENT_TOO_LONG');
    const authorName = input.authorName.trim();
    if (authorName.length < 2) throw new Error('NAME_REQUIRED');

    const product = await this.prisma.product.findUnique({
      where: { id: input.productId },
      select: { id: true },
    });
    if (!product) throw new Error('PRODUCT_NOT_FOUND');

    let email: string | null = null;
    if (input.userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: input.userId },
        select: { email: true },
      });
      email = user?.email ?? null;
    }

    const isVerifiedPurchase = await this.hasPurchased(input.productId, input.userId ?? null, email);

    return this.prisma.review.create({
      data: {
        productId: input.productId,
        userId: input.userId ?? null,
        authorName,
        rating,
        title: input.title?.trim() || null,
        content,
        isVerifiedPurchase,
        status: 'PENDING',
      },
      select: {
        id: true,
        authorName: true,
        rating: true,
        title: true,
        content: true,
        isVerifiedPurchase: true,
        status: true,
        createdAt: true,
      },
    });
  }

  /** True when a matching DELIVERED/CONFIRMED order contains the product. */
  private async hasPurchased(
    productId: string,
    userId: string | null,
    email: string | null,
  ): Promise<boolean> {
    const identifiers: Prisma.OrderWhereInput[] = [];
    if (userId) identifiers.push({ userId });
    if (email) identifiers.push({ email: { equals: email, mode: 'insensitive' } });
    if (identifiers.length === 0) return false;

    const order = await this.prisma.order.findFirst({
      where: {
        status: { in: [...VERIFIED_ORDER_STATUSES] },
        OR: identifiers,
        items: { some: { productId } },
      },
      select: { id: true },
    });
    return order !== null;
  }

  // ============================================================================
  // ADMIN
  // ============================================================================

  async adminList(args: { status?: ReviewStatus; page?: number; pageSize?: number }) {
    const page = args.page ?? 1;
    const pageSize = args.pageSize ?? 50;
    const where: Prisma.ReviewWhereInput = {};
    if (args.status) where.status = args.status;

    const [items, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          product: { select: { id: true, title: true, slug: true } },
        },
      }),
      this.prisma.review.count({ where }),
    ]);

    return { total, page, pageSize, items };
  }

  async adminSetStatus(id: string, status: 'APPROVED' | 'REJECTED') {
    const review = await this.prisma.review.findUnique({ where: { id }, select: { id: true } });
    if (!review) throw new Error('REVIEW_NOT_FOUND');
    return this.prisma.review.update({
      where: { id },
      data: { status },
      include: { product: { select: { id: true, title: true, slug: true } } },
    });
  }

  async adminDelete(id: string) {
    const review = await this.prisma.review.findUnique({ where: { id }, select: { id: true } });
    if (!review) throw new Error('REVIEW_NOT_FOUND');
    await this.prisma.review.delete({ where: { id } });
  }
}