import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { CheckoutForm } from './_components/CheckoutForm';
import { Button } from '@/components/ui/button';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCartForOwner, getUserAddresses } from '@/lib/server/storefront-data';
import type { Cart, Address } from '@/lib/types';

export const metadata: Metadata = {
  title: 'Checkout',
  robots: { index: false, follow: false },
};

// Reads the cart cookie + Supabase session — always per-request.
export const dynamic = 'force-dynamic';

const SESSION_COOKIE = 'vv_cart_sid';

export default async function CheckoutPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Resolve the cart owner exactly like the cart API does: a logged-in user's
  // cart is keyed by userId, a guest's by the vv_cart_sid cookie. We read the
  // cart straight from the DB (no server-side /api/cart self-fetch, which
  // could silently return empty on Vercel → the "Nothing to check out" bug).
  const jar = await cookies();
  const sessionId = jar.get(SESSION_COOKIE)?.value;
  const cart = (await getCartForOwner(
    user ? { userId: user.id } : { sessionId },
  )) as unknown as Cart | null;

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

  const addresses = user
    ? ((await getUserAddresses(user.id)) as unknown as Address[])
    : [];

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