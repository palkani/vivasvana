import type { PrismaClient, ProductVariant } from '@vivasvana/db';
import { Prisma } from '@vivasvana/db';

/**
 * ProductVariant admin management. A product (e.g. "Foxtail Millet") can have
 * several purchasable variants ("500g", "1kg") each with its own SKU, price,
 * sale price, stock and shipping weight. SKUs are globally unique (schema-level
 * @unique), so create/update guard against collisions and surface 'SKU_TAKEN'.
 */

export interface VariantCreateInput {
  title: string;
  sku: string;
  price: string;
  salePrice?: string | null;
  stock?: number;
  weight?: string | null;
  sortOrder?: number;
}

export type VariantUpdateInput = Partial<VariantCreateInput>;

export class VariantService {
  constructor(private readonly prisma: PrismaClient) {}

  async list(productId: string): Promise<ProductVariant[]> {
    return this.prisma.productVariant.findMany({
      where: { productId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async create(productId: string, input: VariantCreateInput): Promise<ProductVariant> {
    // Ensure the parent product exists so we never orphan a variant.
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });
    if (!product) throw new Error('PRODUCT_NOT_FOUND');

    try {
      return await this.prisma.productVariant.create({
        data: {
          productId,
          title: input.title.trim(),
          sku: input.sku.trim(),
          price: new Prisma.Decimal(input.price),
          salePrice:
            input.salePrice === undefined || input.salePrice === null
              ? null
              : new Prisma.Decimal(input.salePrice),
          stock: input.stock ?? 0,
          weight:
            input.weight === undefined || input.weight === null
              ? null
              : new Prisma.Decimal(input.weight),
          sortOrder: input.sortOrder ?? 0,
        },
      });
    } catch (err) {
      throw mapUniqueError(err);
    }
  }

  async update(id: string, input: VariantUpdateInput): Promise<ProductVariant> {
    const existing = await this.prisma.productVariant.findUnique({ where: { id } });
    if (!existing) throw new Error('VARIANT_NOT_FOUND');

    try {
      return await this.prisma.productVariant.update({
        where: { id },
        data: {
          title: input.title === undefined ? undefined : input.title.trim(),
          sku: input.sku === undefined ? undefined : input.sku.trim(),
          price: input.price === undefined ? undefined : new Prisma.Decimal(input.price),
          salePrice:
            input.salePrice === undefined
              ? undefined
              : input.salePrice === null
                ? null
                : new Prisma.Decimal(input.salePrice),
          stock: input.stock === undefined ? undefined : input.stock,
          weight:
            input.weight === undefined
              ? undefined
              : input.weight === null
                ? null
                : new Prisma.Decimal(input.weight),
          sortOrder: input.sortOrder === undefined ? undefined : input.sortOrder,
        },
      });
    } catch (err) {
      throw mapUniqueError(err);
    }
  }

  async delete(id: string): Promise<void> {
    const existing = await this.prisma.productVariant.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) throw new Error('VARIANT_NOT_FOUND');
    await this.prisma.productVariant.delete({ where: { id } });
  }
}

/** Map a Prisma unique-constraint violation on `sku` to our sentinel error. */
function mapUniqueError(err: unknown): Error {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    return new Error('SKU_TAKEN');
  }
  return err instanceof Error ? err : new Error('UNKNOWN');
}