import type { Metadata } from 'next';
import { CartView } from './_components/CartView';

export const metadata: Metadata = {
  title: 'Your cart',
  robots: { index: false, follow: false },
};

/**
 * The cart session cookie (vv_cart_sid) is set by the API domain
 * (e.g. up.railway.app), NOT the web domain (vercel.app). The browser
 * never sends that cookie to Vercel, so server-side cookie forwarding
 * here always saw an empty jar → always returned a fresh empty cart →
 * the brief flash on first paint always said "your cart is empty"
 * even when the user had items.
 *
 * CartView already does a client-side `fetch()` against the API
 * directly, where the cookie IS sent. Skip the server fetch entirely
 * and let the client be the source of truth. Trade-off is one extra
 * network round-trip on first paint; gain is correctness.
 */
export const dynamic = 'force-dynamic';

export default function CartPage() {
  return (
    <div className="container py-10">
      <h1 className="mb-8 font-serif text-3xl font-semibold tracking-tight md:text-4xl">
        Your cart
      </h1>
      <CartView initialCart={null} />
    </div>
  );
}
