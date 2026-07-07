import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { api, type ApiError } from '@/lib/api';
import { formatINR } from '@/lib/utils';
import { stateName } from '@/lib/india-states';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Order } from '@/lib/types';

export const metadata: Metadata = {
  title: 'Order confirmed',
  robots: { index: false, follow: false },
};

interface PageProps {
  searchParams: Promise<{ orderNumber?: string; email?: string }>;
}

function estimatedDelivery(): string {
  // Phase 2 placeholder: 5 business days from now. Shiprocket integration
  // in Phase 3 replaces this with the carrier's real ETA.
  const d = new Date();
  d.setDate(d.getDate() + 5);
  return d.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

export default async function OrderConfirmedPage({ searchParams }: PageProps) {
  const { orderNumber, email } = await searchParams;
  if (!orderNumber || !email) return notFound();

  let order: Order | null = null;
  try {
    order = await api.get<Order>(
      `/api/orders/lookup?orderNumber=${encodeURIComponent(orderNumber)}&email=${encodeURIComponent(email)}`,
      { cache: 'no-store' },
    );
  } catch (err) {
    if ((err as ApiError).status === 404) return notFound();
    throw err;
  }
  if (!order) return notFound();

  return (
    <div className="container max-w-3xl py-12">
      <div className="mb-8 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-leaf-500/10">
          <span className="text-3xl text-leaf-600">✓</span>
        </div>
        <h1 className="mt-4 font-serif text-3xl font-semibold tracking-tight md:text-4xl">
          Thank you, {order.shippingAddress?.name?.split(' ')[0] ?? 'friend'}!
        </h1>
        <p className="mt-2 text-muted-foreground">
          Your order is confirmed. We&rsquo;ll email a receipt to{' '}
          <span className="font-medium text-foreground">{order.email}</span>.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">Order {order.orderNumber}</CardTitle>
            <p className="text-xs text-muted-foreground">
              Placed on{' '}
              {new Date(order.placedAt).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </p>
          </div>
          <Badge variant={order.paymentStatus === 'PAID' ? 'success' : 'outline'}>
            {order.paymentMethod === 'COD' ? 'COD · payable on delivery' : order.paymentStatus}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="space-y-2 text-sm">
            {order.items.map((item) => (
              <li key={item.id} className="flex justify-between">
                <span>
                  {item.title} × {item.quantity}
                </span>
                <span className="tabular-nums">{formatINR(item.total)}</span>
              </li>
            ))}
          </ul>
          <hr />
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span className="tabular-nums">{formatINR(order.subtotal)}</span>
            </div>
            {parseFloat(order.discount) > 0 && (
              <div className="flex justify-between text-leaf-600">
                <span>Discount{order.discountCode && ` (${order.discountCode})`}</span>
                <span className="tabular-nums">−{formatINR(order.discount)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Shipping</span>
              <span className="tabular-nums">{formatINR(order.shipping)}</span>
            </div>
            {parseFloat(order.codFee) > 0 && (
              <div className="flex justify-between">
                <span>COD fee</span>
                <span className="tabular-nums">{formatINR(order.codFee)}</span>
              </div>
            )}
            <div className="flex justify-between pt-2 text-base font-semibold">
              <span>Total</span>
              <span className="tabular-nums">{formatINR(order.total)}</span>
            </div>
          </div>
          <hr />
          {order.shippingAddress && (
            <div className="space-y-1 text-sm">
              <p className="text-xs text-muted-foreground">Shipping to</p>
              <p>{order.shippingAddress.name}</p>
              <p className="text-muted-foreground">
                {order.shippingAddress.addressLine}
                {order.shippingAddress.landmark ? `, ${order.shippingAddress.landmark}` : ''}
                <br />
                {order.shippingAddress.city}, {stateName(order.shippingAddress.state)} —{' '}
                {order.shippingAddress.pincode}
                <br />
                {order.shippingAddress.phone}
              </p>
            </div>
          )}
          <div className="rounded-md bg-brand-50 p-4 text-sm">
            <p className="font-medium">Expected delivery: {estimatedDelivery()}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Shiprocket tracking link arrives as soon as the package is dispatched.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/products">Continue shopping</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/account/orders">View my orders</Link>
        </Button>
      </div>
    </div>
  );
}
