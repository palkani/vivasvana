import type { PrismaClient, Prisma } from '@vivasvana/db';

/**
 * Cart ownership rules:
 *   - Logged-in user: cart resolved by userId (one active cart per user)
 *   - Guest: cart resolved by sessionId (UUID minted client-side, persisted in localStorage + cookie)
 *
 * On login, merge guest cart → user cart (mergeGuestIntoUser).
 *
 * Price at add-time is snapshotted onto cart_items. We re-validate against
 * current product price at checkout (Phase 2) but never silently change it
 * here — the customer sees what they added.
 *
 * Note: Postgres treats NULL as distinct in unique constraints, so two rows
 * with the same (cartId, productId, NULL variantId) would both be allowed.
 * We compensate by doing findFirst + branch instead of relying on upsert
 * against the compound unique.
 */

const CART_INCLUDE = {
  items: {
    include: {
      product: {
        select: {
          id: true,
          slug: true,
          title: true,
          price: true,
          salePrice: true,
          stock: true,
          status: true,
          images: { orderBy: { sortOrder: 'asc' as const }, take: 1 },
        },
      },
      variant: { select: { id: true, title: true, price: true, salePrice: true, stock: true } },
    },
    orderBy: { createdAt: 'asc' as const },
  },
} satisfies Prisma.CartInclude;

export class CartService {
  constructor(private readonly prisma: PrismaClient) {}

  /** Get or create an empty cart for this owner. */
  async getOrCreate(owner: { userId?: string; sessionId?: string }) {
    if (!owner.userId && !owner.sessionId) {
      throw new Error('cart owner requires userId or sessionId');
    }

    const existing = await this.prisma.cart.findFirst({
      where: owner.userId
        ? { userId: owner.userId }
        : { sessionId: owner.sessionId, userId: null },
      include: CART_INCLUDE,
    });
    if (existing) return existing;

    return this.prisma.cart.create({
      data: { userId: owner.userId ?? null, sessionId: owner.sessionId ?? null },
      include: CART_INCLUDE,
    });
  }

  async getById(cartId: string) {
    return this.prisma.cart.findUnique({ where: { id: cartId }, include: CART_INCLUDE });
  }

  private async findExistingItem(cartId: string, productId: string, variantId: string | null) {
    return this.prisma.cartItem.findFirst({
      where: { cartId, productId, variantId },
    });
  }

  async addItem(
    owner: { userId?: string; sessionId?: string },
    args: { productId: string; variantId?: string | undefined; quantity: number },
  ) {
    const product = await this.prisma.product.findFirst({
      where: { id: args.productId, deletedAt: null, status: 'PUBLISHED' },
    });
    if (!product) throw new Error('PRODUCT_NOT_AVAILABLE');

    let price = product.salePrice ?? product.price;
    let availableStock = product.stock;

    if (args.variantId) {
      const variant = await this.prisma.productVariant.findFirst({
        where: { id: args.variantId, productId: product.id },
      });
      if (!variant) throw new Error('VARIANT_NOT_FOUND');
      price = variant.salePrice ?? variant.price;
      availableStock = variant.stock;
    }

    const cart = await this.getOrCreate(owner);
    const variantId = args.variantId ?? null;
    const existing = await this.findExistingItem(cart.id, args.productId, variantId);
    const targetQty = (existing?.quantity ?? 0) + args.quantity;
    if (targetQty > availableStock) throw new Error('INSUFFICIENT_STOCK');

    if (existing) {
      await this.prisma.cartItem.update({
        where: { id: existing.id },
        data: { quantity: targetQty },
      });
    } else {
      await this.prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId: args.productId,
          variantId,
          quantity: args.quantity,
          price,
        },
      });
    }

    return this.getById(cart.id);
  }

  async updateItem(cartId: string, itemId: string, quantity: number) {
    if (quantity <= 0) {
      await this.prisma.cartItem.deleteMany({ where: { id: itemId, cartId } });
    } else {
      const item = await this.prisma.cartItem.findFirst({
        where: { id: itemId, cartId },
        include: { product: true, variant: true },
      });
      if (!item) throw new Error('ITEM_NOT_FOUND');
      const stock = item.variant?.stock ?? item.product.stock;
      if (quantity > stock) throw new Error('INSUFFICIENT_STOCK');
      await this.prisma.cartItem.update({ where: { id: itemId }, data: { quantity } });
    }
    return this.getById(cartId);
  }

  async removeItem(cartId: string, itemId: string) {
    await this.prisma.cartItem.deleteMany({ where: { id: itemId, cartId } });
    return this.getById(cartId);
  }

  async clear(cartId: string) {
    await this.prisma.cartItem.deleteMany({ where: { cartId } });
    return this.getById(cartId);
  }

  /** Merge a guest cart into a user cart on login. Idempotent. */
  async mergeGuestIntoUser(args: { userId: string; sessionId: string }) {
    const guestCart = await this.prisma.cart.findFirst({
      where: { sessionId: args.sessionId, userId: null },
      include: { items: true },
    });
    if (!guestCart || guestCart.items.length === 0) {
      return this.getOrCreate({ userId: args.userId });
    }

    const userCart = await this.getOrCreate({ userId: args.userId });

    await this.prisma.$transaction(async (tx) => {
      for (const item of guestCart.items) {
        const existing = await tx.cartItem.findFirst({
          where: { cartId: userCart.id, productId: item.productId, variantId: item.variantId },
        });
        if (existing) {
          await tx.cartItem.update({
            where: { id: existing.id },
            data: { quantity: existing.quantity + item.quantity },
          });
        } else {
          await tx.cartItem.create({
            data: {
              cartId: userCart.id,
              productId: item.productId,
              variantId: item.variantId,
              quantity: item.quantity,
              price: item.price,
            },
          });
        }
      }
      await tx.cart.delete({ where: { id: guestCart.id } });
    });

    return this.getById(userCart.id);
  }
}
