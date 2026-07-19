import type { PrismaClient, ContentStatus } from '@vivasvana/db';

export interface TestimonialInput {
  name: string;
  location?: string | null;
  content: string;
  rating?: number;
  imageUrl?: string | null;
  status?: ContentStatus;
  sortOrder?: number;
}

export class TestimonialService {
  constructor(private readonly prisma: PrismaClient) {}

  adminList() {
    return this.prisma.testimonial.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
  }

  create(input: TestimonialInput) {
    return this.prisma.testimonial.create({
      data: {
        name: input.name.trim(),
        location: input.location ?? null,
        content: input.content.trim(),
        rating: input.rating ?? 5,
        imageUrl: input.imageUrl ?? null,
        status: input.status ?? 'PUBLISHED',
        sortOrder: input.sortOrder ?? 0,
      },
    });
  }

  update(id: string, input: Partial<TestimonialInput>) {
    return this.prisma.testimonial.update({
      where: { id },
      data: {
        ...input,
        name: input.name?.trim(),
        content: input.content?.trim(),
      },
    });
  }

  async delete(id: string) {
    await this.prisma.testimonial.delete({ where: { id } });
  }
}
