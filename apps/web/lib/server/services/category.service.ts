import type { PrismaClient } from '@vivasvana/db';

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export class CategoryService {
  constructor(private readonly prisma: PrismaClient) {}

  async list() {
    const cats = await this.prisma.category.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        parent: { select: { id: true, name: true } },
        _count: { select: { products: true } },
      },
    });
    return cats.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      parentId: c.parentId,
      parentName: c.parent?.name ?? null,
      sortOrder: c.sortOrder,
      productCount: c._count.products,
    }));
  }

  get(id: string) {
    return this.prisma.category.findUnique({ where: { id } });
  }

  async create(input: {
    name: string;
    slug?: string;
    description?: string | null;
    parentId?: string | null;
    sortOrder?: number;
  }) {
    const slug = input.slug?.trim() || slugify(input.name);
    if (!slug) throw new Error('INVALID_SLUG');
    if (await this.prisma.category.findUnique({ where: { slug } })) throw new Error('SLUG_TAKEN');
    return this.prisma.category.create({
      data: {
        name: input.name.trim(),
        slug,
        description: input.description ?? null,
        parentId: input.parentId ?? null,
        sortOrder: input.sortOrder ?? 0,
      },
    });
  }

  async update(
    id: string,
    input: Partial<{
      name: string;
      slug: string;
      description: string | null;
      parentId: string | null;
      sortOrder: number;
    }>,
  ) {
    if (input.parentId === id) throw new Error('INVALID_PARENT');
    if (input.slug) {
      const clash = await this.prisma.category.findFirst({
        where: { slug: input.slug, id: { not: id } },
      });
      if (clash) throw new Error('SLUG_TAKEN');
    }
    return this.prisma.category.update({
      where: { id },
      data: { ...input, name: input.name?.trim() },
    });
  }

  async delete(id: string) {
    const children = await this.prisma.category.count({ where: { parentId: id } });
    if (children > 0) throw new Error('HAS_CHILDREN');
    await this.prisma.category.delete({ where: { id } });
  }
}
