import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { CartView } from './_components/CartView';
import { api } from '@/lib/api';
import type { Cart } from '@/lib/types';

export const metadata: Metadata = {
  title: 'Your cart',
  robots: { index: false, follow: false },
};

async function fetchCart(): Promise<Cart | null> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');
  try {
    return await api.get<Cart>('/api/cart', {
      cache: 'no-store',
      forwardCookies: cookieHeader,
    });
  } catch (e) {
    console.error('Failed to load cart on server:', e);
    return null;
  }
}

export default async function CartPage() {
  const cart = await fetchCart();
  return (
    <div className="container py-10">
      <h1 className="mb-8 font-serif text-3xl font-semibold tracking-tight md:text-4xl">
        Your cart
      </h1>
      <CartView initialCart={cart} />
    </div>
  );
}
