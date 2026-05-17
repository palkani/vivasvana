import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { api, type ApiError } from '@/lib/api';
import type { Order } from '@/lib/types';
import { MockPaymentPanel } from './_components/MockPaymentPanel';

export const metadata: Metadata = {
  title: 'Complete payment',
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ orderId: string }>;
}

export default async function PayPage({ params }: PageProps) {
  const { orderId } = await params;

  // We don't bearer-auth this fetch — guests need to be able to pay.
  // The order ID is a UUID, so the URL acts as a capability token.
  let order: Order | null = null;
  try {
    // /api/orders/:id is auth-only. Use the public lookup that takes
    // orderNumber+email — but we don't have those here. For now, fetch
    // the order via the admin sidestep is wrong too. Solution: add a
    // dedicated GET /api/orders/by-id/:id route that's safe to expose
    // because guessing UUIDs is infeasible. For Phase 2 mock flow, we
    // rely on the next commit to add it; here we accept that if you
    // refresh this page logged out, you'll see a 404 fallback.
    order = await api.get<Order>(`/api/orders/by-id/${orderId}`, { cache: 'no-store' });
  } catch (e) {
    const err = e as ApiError;
    if (err.status === 404) return notFound();
    throw e;
  }
  if (!order) return notFound();

  return (
    <div className="container max-w-2xl py-10">
      <h1 className="mb-2 font-serif text-3xl font-semibold tracking-tight">
        Complete payment
      </h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Order <span className="font-mono">{order.orderNumber}</span>
      </p>
      <MockPaymentPanel order={order} />
    </div>
  );
}
