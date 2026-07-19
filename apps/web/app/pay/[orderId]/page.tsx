import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getOrderByIdPublic } from '@/lib/server/storefront-data';
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

  // Guests must be able to pay, so no bearer auth — the UUID in the URL is the
  // capability token (guessing v4 UUIDs is infeasible). Read straight from the
  // DB rather than self-fetching /api/orders/by-id (that internal hop can fail
  // on Vercel and would strand the shopper on the payment step).
  const order = (await getOrderByIdPublic(orderId)) as unknown as Order | null;
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
