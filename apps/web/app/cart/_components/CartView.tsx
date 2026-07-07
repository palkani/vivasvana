'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DiscountInput } from '@/components/storefront/DiscountInput';
import { useCartStore, cartItemCount, cartSubtotal } from '@/lib/cart-store';
import { formatINR, pluralize } from '@/lib/utils';
import type { Cart } from '@/lib/types';
import type { DiscountInfo } from '@/lib/discount';

const FREE_SHIPPING_THRESHOLD = 400;
const BASE_SHIPPING = 50;
const DISCOUNT_STORAGE_KEY = 'vv_discount';

interface Props {
  initialCart: Cart | null;
}

export function CartView({ initialCart }: Props) {
  const { cart, updateItem, removeItem, fetch, loading } = useCartStore();
  const [discount, setDiscount] = useState<DiscountInfo | null>(null);

  // Hydrate the persisted store from server snapshot on first render
  useEffect(() => {
    if (initialCart) {
      useCartStore.setState({ cart: initialCart });
    } else {
      fetch();
    }
    // Restore any applied discount across page loads
    try {
      const raw = localStorage.getItem(DISCOUNT_STORAGE_KEY);
      if (raw) setDiscount(JSON.parse(raw) as DiscountInfo);
    } catch {
      // ignore
    }
  }, [initialCart, fetch]);

  const view = cart ?? initialCart;
  const items = view?.items ?? [];
  const subtotal = cartSubtotal(view);
  const count = cartItemCount(view);
  const discountAmount = discount ? Math.min(parseFloat(discount.appliedAmount), subtotal) : 0;
  const baseShipping =
    subtotal >= FREE_SHIPPING_THRESHOLD || subtotal === 0 ? 0 : BASE_SHIPPING;
  const shipping = discount?.freeShipping ? 0 : baseShipping;
  const total = Math.max(0, subtotal - discountAmount + shipping);
  const toFreeShipping = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);

  function applyDiscount(info: DiscountInfo) {
    setDiscount(info);
    try {
      localStorage.setItem(DISCOUNT_STORAGE_KEY, JSON.stringify(info));
    } catch {
      // ignore
    }
  }

  function clearDiscount() {
    setDiscount(null);
    try {
      localStorage.removeItem(DISCOUNT_STORAGE_KEY);
    } catch {
      // ignore
    }
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-lg border bg-card p-12 text-center">
        <p className="text-5xl">🛒</p>
        <h2 className="text-xl font-semibold">Your cart is empty</h2>
        <p className="text-muted-foreground">Browse our millet blends to get started.</p>
        <Button asChild>
          <Link href="/products">Shop products</Link>
        </Button>
      </div>
    );
  }

  return (
    // minmax(0, 1fr) — without the explicit `0` min, CSS grid uses `auto` and
    // a long product title forces the left column wider than its share, which
    // pushes the 360px sidebar past the viewport edge.
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0 space-y-3">
        <p className="text-sm text-muted-foreground">
          {count} {pluralize(count, 'item')} in cart
        </p>

        {items.map((item) => {
          const image = item.product.images[0];
          const maxStock = item.variant?.stock ?? item.product.stock;
          const lineTotal = parseFloat(item.price) * item.quantity;
          return (
            <Card key={item.id}>
              {/* Mobile: image + details stack as a row, controls + price wrap
                  to a second row below. Desktop: everything on one line. */}
              <CardContent className="flex flex-wrap items-center gap-3 p-3 sm:gap-4 sm:p-4">
                <Link
                  href={`/products/${item.product.slug}`}
                  className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md bg-muted sm:h-20 sm:w-20"
                >
                  {image && (
                    <Image
                      src={image.url}
                      alt={image.altText ?? item.product.title}
                      fill
                      sizes="80px"
                      className="object-cover"
                    />
                  )}
                </Link>
                {/* flex-1 + min-w-0 is the canonical way to make a flex child
                    actually shrink and let `line-clamp` work. */}
                <div className="min-w-0 flex-1 basis-[60%]">
                  <Link
                    href={`/products/${item.product.slug}`}
                    className="block line-clamp-2 text-sm font-medium leading-snug hover:text-primary sm:text-base"
                  >
                    {item.product.title.split('|')[0]?.trim() ?? item.product.title}
                  </Link>
                  {item.variant && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{item.variant.title}</p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                    {formatINR(item.price)} each
                  </p>
                </div>
                {/* Qty + line total + remove — wraps under on narrow screens
                    via flex-wrap on the parent. */}
                <div className="ml-auto flex items-center gap-2 sm:gap-3">
                  <div className="flex items-center gap-1 rounded-md border">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-none"
                      onClick={() => updateItem(item.id, item.quantity - 1)}
                      disabled={loading}
                      aria-label="Decrease quantity"
                    >
                      −
                    </Button>
                    <span className="w-8 text-center text-sm tabular-nums" aria-live="polite">
                      {item.quantity}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-none"
                      onClick={() => updateItem(item.id, item.quantity + 1)}
                      disabled={loading || item.quantity >= maxStock}
                      aria-label="Increase quantity"
                    >
                      +
                    </Button>
                  </div>
                  <div className="min-w-[64px] text-right text-sm font-medium tabular-nums sm:text-base">
                    {formatINR(lineTotal)}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => removeItem(item.id)}
                    disabled={loading}
                    aria-label="Remove item"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="h-fit min-w-0 lg:sticky lg:top-20">
        <CardHeader>
          <CardTitle className="text-lg">Order summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span className="tabular-nums">{formatINR(subtotal)}</span>
          </div>
          {discountAmount > 0 && (
            <div className="flex justify-between text-leaf-600">
              <span>Discount ({discount?.code})</span>
              <span className="tabular-nums">−{formatINR(discountAmount)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>Shipping</span>
            <span className="tabular-nums">
              {shipping === 0 ? <span className="text-leaf-600">Free</span> : formatINR(shipping)}
            </span>
          </div>
          {toFreeShipping > 0 && !discount?.freeShipping && (
            <p className="rounded-md bg-brand-50 p-3 text-xs text-brand-900">
              Add {formatINR(toFreeShipping)} more for free shipping.
            </p>
          )}
          <DiscountInput
            subtotal={subtotal}
            applied={discount}
            onApply={applyDiscount}
            onClear={clearDiscount}
          />
          <hr />
          <div className="flex justify-between text-base font-semibold">
            <span>Total</span>
            <span className="tabular-nums">{formatINR(total)}</span>
          </div>
          <p className="text-xs text-muted-foreground">incl. GST · COD available</p>

          <Button className="w-full" size="lg" asChild>
            <Link href="/checkout">Checkout</Link>
          </Button>
          <Button variant="outline" className="w-full" asChild>
            <Link href="/products">Continue shopping</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
