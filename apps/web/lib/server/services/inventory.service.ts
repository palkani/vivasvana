import type { PrismaClient, Prisma, StockChangeReason } from '@vivasvana/db';

/**
 * Inventory service — low-stock reporting and ledger-backed stock adjustments.
 *
 * The golden rule: manual stock changes MUST go through `adjust()` so the
 * `stock_movements` ledger stays a truthful audit log. `adjust()` mutates the
 * product/variant `stock` column AND writes the matching StockMovement row in
 * one `$transaction`, guarding against a resulting negative on-hand quantity.
 */

export interface LowStockVariant {
  id: string;
  title: string;
  sku: string;
  stock: number;
}

export interface LowStockRow {
  id: string;
  title: string;
  sku: string;
  stock: number;
  lowStockAt: number;
  variants: LowStockVariant[];
}

export interface AdjustInput {
  productId: string;
  variantId?: string | null;
  delta: number;
  reason: StockChangeReason;
  notes?: string | null;
  reference?: string | null;
  createdBy?: string | null;
}

export interface MovementsQuery {
  productId?: string;
  page?: number;
  pageSize?: number;
}

export class InventoryService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Published products (and their variants) at or below their low-stock
   * threshold, most-depleted first. Variants have no per-variant threshold, so
   * we surface any variant whose stock is <= the parent product's `lowStockAt`.
   */
  async listLowStock(): Promise<LowStockRow[]> {
    // Prisma can't compare two columns (stock <= lowStockAt) in a `where`, so we
    // filter with a raw query for the matching product ids, then hydrate.
    const ids = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id
        FROM products
       WHERE status = 'PUBLISHED'
         AND deleted_at IS NULL
         AND stock <= low_stock_at
       ORDER BY stock ASC
    `;

    if (ids.length === 0) return [];
    const idList = ids.map((r) => r.id);

    const products = await this.prisma.product.findMany({
      where: { id: { in: idList } },
      select: {
        id: true,
        title: true,
        sku: true,
        stock: true,
        lowStockAt: true,
        variants: {
          select: { id: true, title: true, sku: true, stock: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    // Preserve the stock-asc ordering the raw query produced.
    const order = new Map(idList.map((id, i) => [id, i]));
    products.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));

    return products.map((p) => ({
      id: p.id,
      title: p.title,
      sku: p.sku,
      stock: p.stock,
      lowStockAt: p.lowStockAt,
      variants: p.variants.filter((v) => v.stock <= p.lowStockAt),
    }));
  }

  /**
   * Atomically apply a stock delta to a product OR one of its variants and
   * record the change in the ledger. Throws:
   *  - 'PRODUCT_NOT_FOUND' / 'VARIANT_NOT_FOUND' if the target doesn't exist
   *  - 'NEGATIVE_STOCK' if the delta would drive on-hand below zero
   */
  async adjust(input: AdjustInput) {
    const { productId, variantId, delta, reason } = input;

    return this.prisma.$transaction(async (tx) => {
      let newStock: number;

      if (variantId) {
        const variant = await tx.productVariant.findUnique({
          where: { id: variantId },
          select: { id: true, productId: true, stock: true },
        });
        if (!variant || variant.productId !== productId) {
          throw new Error('VARIANT_NOT_FOUND');
        }
        newStock = variant.stock + delta;
        if (newStock < 0) throw new Error('NEGATIVE_STOCK');
        await tx.productVariant.update({
          where: { id: variantId },
          data: { stock: newStock },
        });
      } else {
        const product = await tx.product.findUnique({
          where: { id: productId },
          select: { id: true, stock: true },
        });
        if (!product) throw new Error('PRODUCT_NOT_FOUND');
        newStock = product.stock + delta;
        if (newStock < 0) throw new Error('NEGATIVE_STOCK');
        await tx.product.update({
          where: { id: productId },
          data: { stock: newStock },
        });
      }

      const movement = await tx.stockMovement.create({
        data: {
          productId,
          variantId: variantId ?? null,
          delta,
          reason,
          reference: input.reference ?? null,
          notes: input.notes ?? null,
          createdBy: input.createdBy ?? null,
        },
      });

      return { movement, newStock };
    });
  }

  /** Recent ledger entries, newest first, optionally scoped to one product. */
  async movements(args: MovementsQuery) {
    const page = args.page ?? 1;
    const pageSize = args.pageSize ?? 50;
    const where: Prisma.StockMovementWhereInput = {};
    if (args.productId) where.productId = args.productId;

    const [items, total] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.stockMovement.count({ where }),
    ]);

    // Attach product/variant labels so the admin UI can render names, not ids.
    const productIds = [...new Set(items.map((m) => m.productId))];
    const variantIds = [...new Set(items.map((m) => m.variantId).filter((v): v is string => !!v))];

    const [products, variants] = await Promise.all([
      productIds.length
        ? this.prisma.product.findMany({
            where: { id: { in: productIds } },
            select: { id: true, title: true, sku: true },
          })
        : Promise.resolve([]),
      variantIds.length
        ? this.prisma.productVariant.findMany({
            where: { id: { in: variantIds } },
            select: { id: true, title: true, sku: true },
          })
        : Promise.resolve([]),
    ]);

    const productById = new Map(products.map((p) => [p.id, p]));
    const variantById = new Map(variants.map((v) => [v.id, v]));

    return {
      total,
      page,
      pageSize,
      items: items.map((m) => ({
        ...m,
        product: productById.get(m.productId) ?? null,
        variant: m.variantId ? (variantById.get(m.variantId) ?? null) : null,
      })),
    };
  }
}