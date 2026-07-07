import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { CheckoutForm } from './_components/CheckoutForm';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { Cart, Address } from '@/lib/types';

export const metadata: Metadata = {
  title: 'Checkout',
  robots: { index: false, follow: false },
};

// Reads cart cookies + Supabase session — always per-request.
export const dynamic = 'force-dynamic';

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

  // Nothing to check out → render an empty state instead of redirecting.
  // redirect() from a server-component page throws NEXT_REDIRECT, which
  // surfaces as a Console Error in the Next 15 dev overlay. Inline render
  // is quiet AND gives clearer feedback ("here's why nothing happened").
  if (!cart || cart.items.length === 0) {
    return (
      <div className="container py-20">
        <div className="mx-auto max-w-md rounded-lg border bg-card p-10 text-center">
          <h1 className="font-serif text-2xl font-semibold tracking-tight">
            Nothing to check out
          </h1>
          <p className="mt-3 text-muted-foreground">
            Your cart is empty. Add a product first, then come back.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild>
              <Link href="/products">Shop products</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/account/orders">View past orders</Link>
            </Button>
          </div>
        </div>
      </div>
    );
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
