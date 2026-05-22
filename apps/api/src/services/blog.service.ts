import type { PrismaClient, ContentStatus } from '@vivasvana/db';
import { Prisma } from '@vivasvana/db';

export interface BlogInput {
  slug?: string;
  title: string;
  excerpt?: string | null;
  content: string;
  featuredImage?: string | null;
  author: string;
  authorBio?: string | null;
  status?: ContentStatus;
  publishedAt?: Date | null;
  readingMinutes?: number | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
}

const SLUG_FROM = /[^a-z0-9]+/g;

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(SLUG_FROM, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

function estimateReadingMinutes(markdown: string): number {
  // ~200 wpm — Indian English reader average, plenty close enough for an estimate.
  const words = markdown.trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
}

export class BlogService {
  constructor(private readonly prisma: PrismaClient) {}

  // ---- PUBLIC ----------------------------------------------------------

  async publicList(args: { page?: number; pageSize?: number; search?: string }) {
    const page = args.page ?? 1;
    const pageSize = args.pageSize ?? 12;
    const where: Prisma.BlogPostWhereInput = {
      status: 'PUBLISHED',
      publishedAt: { lte: new Date() },
    };
    if (args.search) {
      const q = args.search.trim();
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { excerpt: { contains: q, mode: 'insensitive' } },
      ];
    }
    const [items, total] = await Promise.all([
      this.prisma.blogPost.findMany({
        where,
        orderBy: { publishedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          slug: true,
          title: true,
          excerpt: true,
          featuredImage: true,
          author: true,
          publishedAt: true,
          readingMinutes: true,
        },
      }),
      this.prisma.blogPost.count({ where }),
    ]);
    return { total, page, pageSize, items };
  }

  async publicGet(slug: string) {
    const post = await this.prisma.blogPost.findUnique({ where: { slug } });
    if (!post || post.status !== 'PUBLISHED' || !post.publishedAt || post.publishedAt > new Date()) {
      return null;
    }
    return post;
  }

  // ---- ADMIN -----------------------------------------------------------

  async adminList(args: {
    page?: number;
    pageSize?: number;
    search?: string;
    status?: ContentStatus;
  }) {
    const page = args.page ?? 1;
    const pageSize = args.pageSize ?? 25;
    const where: Prisma.BlogPostWhereInput = {};
    if (args.status) where.status = args.status;
    if (args.search) {
      const q = args.search.trim();
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { slug: { contains: q, mode: 'insensitive' } },
        { author: { contains: q, mode: 'insensitive' } },
      ];
    }
    const [items, total] = await Promise.all([
      this.prisma.blogPost.findMany({
        where,
        orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          slug: true,
          title: true,
          author: true,
          status: true,
          publishedAt: true,
          updatedAt: true,
          createdAt: true,
          readingMinutes: true,
        },
      }),
      this.prisma.blogPost.count({ where }),
    ]);
    return { total, page, pageSize, items };
  }

  async adminGet(id: string) {
    return this.prisma.blogPost.findUnique({ where: { id } });
  }

  async adminCreate(input: BlogInput) {
    const baseSlug = (input.slug?.trim() || slugify(input.title)) || `post-${Date.now()}`;
    const slug = await this.ensureUniqueSlug(baseSlug);
    const status = input.status ?? 'DRAFT';
    return this.prisma.blogPost.create({
      data: {
        slug,
        title: input.title.trim(),
        excerpt: input.excerpt?.trim() || null,
        content: input.content,
        featuredImage: input.featuredImage?.trim() || null,
        author: input.author.trim(),
        authorBio: input.authorBio?.trim() || null,
        status,
        publishedAt: status === 'PUBLISHED' ? input.publishedAt ?? new Date() : input.publishedAt ?? null,
        readingMinutes: input.readingMinutes ?? estimateReadingMinutes(input.content),
        metaTitle: input.metaTitle?.trim() || null,
        metaDescription: input.metaDescription?.trim() || null,
      },
    });
  }

  async adminUpdate(id: string, input: Partial<BlogInput>) {
    const existing = await this.prisma.blogPost.findUnique({ where: { id } });
    if (!existing) throw new Error('POST_NOT_FOUND');

    let nextSlug = existing.slug;
    if (input.slug && input.slug.trim() !== existing.slug) {
      nextSlug = await this.ensureUniqueSlug(slugify(input.slug.trim()), existing.id);
    }

    const status = input.status ?? existing.status;
    const publishedAt =
      input.publishedAt !== undefined
        ? input.publishedAt
        : status === 'PUBLISHED' && !existing.publishedAt
          ? new Date()
          : existing.publishedAt;

    return this.prisma.blogPost.update({
      where: { id },
      data: {
        slug: nextSlug,
        title: input.title?.trim() ?? undefined,
        excerpt: input.excerpt === undefined ? undefined : input.excerpt?.trim() || null,
        content: input.content ?? undefined,
        featuredImage:
          input.featuredImage === undefined ? undefined : input.featuredImage?.trim() || null,
        author: input.author?.trim() ?? undefined,
        authorBio: input.authorBio === undefined ? undefined : input.authorBio?.trim() || null,
        status,
        publishedAt,
        readingMinutes:
          input.readingMinutes !== undefined
            ? input.readingMinutes
            : input.content
              ? estimateReadingMinutes(input.content)
              : undefined,
        metaTitle:
          input.metaTitle === undefined ? undefined : input.metaTitle?.trim() || null,
        metaDescription:
          input.metaDescription === undefined ? undefined : input.metaDescription?.trim() || null,
      },
    });
  }

  async adminPublish(id: string) {
    const existing = await this.prisma.blogPost.findUnique({ where: { id } });
    if (!existing) throw new Error('POST_NOT_FOUND');
    return this.prisma.blogPost.update({
      where: { id },
      data: { status: 'PUBLISHED', publishedAt: existing.publishedAt ?? new Date() },
    });
  }

  async adminUnpublish(id: string) {
    const existing = await this.prisma.blogPost.findUnique({ where: { id } });
    if (!existing) throw new Error('POST_NOT_FOUND');
    return this.prisma.blogPost.update({
      where: { id },
      data: { status: 'DRAFT' },
    });
  }

  async adminArchive(id: string) {
    const existing = await this.prisma.blogPost.findUnique({ where: { id } });
    if (!existing) throw new Error('POST_NOT_FOUND');
    return this.prisma.blogPost.update({
      where: { id },
      data: { status: 'ARCHIVED' },
    });
  }

  async adminDelete(id: string) {
    const existing = await this.prisma.blogPost.findUnique({ where: { id } });
    if (!existing) throw new Error('POST_NOT_FOUND');
    await this.prisma.blogPost.delete({ where: { id } });
  }

  private async ensureUniqueSlug(base: string, excludeId?: string): Promise<string> {
    let candidate = base || `post-${Date.now()}`;
    let i = 2;
    // Cap retries — beyond 20 collisions, fall back to a timestamp suffix.
    for (let attempt = 0; attempt < 20; attempt++) {
      const clash = await this.prisma.blogPost.findUnique({ where: { slug: candidate } });
      if (!clash || clash.id === excludeId) return candidate;
      candidate = `${base}-${i++}`;
    }
    return `${base}-${Date.now()}`;
  }
}
