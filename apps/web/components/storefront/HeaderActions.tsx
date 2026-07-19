'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { ShoppingBag, Search, UserRound } from 'lucide-react';
import { useCartStore, cartItemCount } from '@/lib/cart-store';
import { cn } from '@/lib/utils';

/**
 * The three action icons in the header (search, account, cart).
 *
 * Lives in a client component so the cart icon can react to live cart state
 * — including a count badge that mirrors the number of items the shopper
 * has in their cart, the way Shopify/Amazon/Flipkart all do.
 *
 * Icon choices:
 *   - ShoppingBasket  — softer/more organic than ShoppingBag, fits the food brand
 *   - UserRound       — rounder, less institutional than the plain User glyph
 *   - Search          — kept; magnifying glass is universally legible
 *
 * Styling principles:
 *   - 44×44 touch targets (Apple HIG / WCAG 2.5.5 minimum)
 *   - Subtle brand-tinted hover state instead of grey hover
 *   - Active route shown with a faint background ring
 *   - Cart badge sits absolute over the icon; appears only when count > 0
 */
export function HeaderActions() {
  const { cart, fetch } = useCartStore();
  const count = cartItemCount(cart);

  // Pull the cart on first paint so the badge isn't a flash of zero. The
  // store guards against duplicate fetches internally.
  useEffect(() => {
    fetch();
  }, [fetch]);

  return (
    <div className="flex items-center gap-1 md:gap-2">
      <IconLink
        href="/products"
        label="Search products"
        icon={<Search className="h-5 w-5" strokeWidth={2} />}
      />
      <IconLink
        href="/account"
        label="Your account"
        icon={<UserRound className="h-5 w-5" strokeWidth={2} />}
      />
      <IconLink
        href="/cart"
        label={count > 0 ? `Cart (${count} item${count === 1 ? '' : 's'})` : 'Cart'}
        icon={
          <span className="relative inline-flex">
            <ShoppingBag className="h-5 w-5" strokeWidth={2} />
            {count > 0 && (
              <span
                aria-hidden
                className="absolute -right-2 -top-2 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-semibold leading-none text-white shadow-sm ring-2 ring-background tabular-nums"
              >
                {count > 99 ? '99+' : count}
              </span>
            )}
          </span>
        }
      />
    </div>
  );
}

interface IconLinkProps {
  href: string;
  label: string;
  icon: React.ReactNode;
}

function IconLink({ href, label, icon }: IconLinkProps) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className={cn(
        'group inline-flex h-11 w-11 items-center justify-center rounded-full',
        'text-foreground/70 transition-colors',
        'hover:bg-brand-50 hover:text-brand-700',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2',
      )}
    >
      {icon}
    </Link>
  );
}
