import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { CheckoutForm } from './_components/CheckoutForm';
import { api } from '@/lib/api';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { Cart, Address } from '@/lib/types';

export const metadata: Metadata = {
  title: 'Checkout',
  robots: { index: false, follow: false },
};

async function fetchCart(): Promise<Cart | null> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');
  try {
    return await api.get<Cart>('/api/cart', { cache: 'no-store', forwardCookies: cookieHeader });
  } catch {
    return null;
  }
}

async function fetchAddressesIfLoggedIn(): Promise<Address[]> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return [];
  try {
    return await api.get<Address[]>('/api/addresses', {
      cache: 'no-store',
      accessToken: session.access_token,
    });
  } catch {
    return [];
  }
}

export default async function CheckoutPage() {
  const cart = await fetchCart();
  if (!cart || cart.items.length === 0) {
    redirect('/cart');
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const addresses = user ? await fetchAddressesIfLoggedIn() : [];

  return (
    <div className="container py-10">
      <h1 className="mb-8 font-serif text-3xl font-semibold tracking-tight md:text-4xl">
        Checkout
      </h1>
      <CheckoutForm
        initialCart={cart}
        savedAddresses={addresses}
        userEmail={user?.email ?? null}
      />
    </div>
  );
}
