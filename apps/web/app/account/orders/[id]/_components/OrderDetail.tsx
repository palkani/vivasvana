'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { accountApi } from '@/lib/account-api';
import { formatINR } from '@/lib/utils';
import { stateName } from '@/lib/india-states';
import type { Order, OrderStatus } from '@/lib/types';

const STEPS: Array<{ key: OrderStatus; label: string }> = [
  { key: 'CONFIRMED', label: 'Confirmed' },
  { key: 'PACKED', label: 'Packed' },
  { key: 'SHIPPED', label: 'Shipped' },
  { key: 'DELIVERED', label: 'Delivered' },
];

function statusIndex(status: OrderStatus): number {
  switch (status) {
    case 'PENDING':
      return -1;
    case 'CONFIRMED':
      return 0;
    case 'PACKED':
      return 1;
    case 'SHIPPED':
      return 2;
    case 'DELIVERED':
      return 3;
    case 'CANCELLED':
    case 'RETURNED':
    case 'REFUNDED':
      return -2;
  }
}

export function OrderDetail({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function load() {
    try {
      const res = await accountApi.get<Order>(`/api/orders/${orderId}`);
      setOrder(res);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  function handleCancel() {
    if (!order) return;
    if (!confirm(`Cancel order ${order.orderNumber}?`)) return;
    startTransition(async () => {
      try {
        await accountApi.post(`/api/orders/${orderId}/cancel`);
        await load();
      } catch (e) {
        alert((e as Error).message);
      }
    });
  }

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!order) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const idx = statusIndex(order.status);
  const canCancel = order.status === 'PENDING' || order.status === 'CONFIRMED';

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Order</p>
          <h1 className="font-mono text-2xl font-semibold">{order.orderNumber}</h1>
          <p className="text-xs text-muted-foreground">
            Placed{' '}
            {new Date(order.placedAt).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={order.status === 'DELIVERED' ? 'success' : 'secondary'}>
            {order.status.toLowerCase()}
          </Badge>
          {order.paymentMethod === 'COD' && <Badge variant="outline">COD</Badge>}
          {canCancel && (
            <Button variant="ghost" size="sm" onClick={handleCancel} disabled={pending}>
              {pending ? 'Cancelling…' : 'Cancel order'}
            </Button>
          )}
        </div>
      </div>

      {/* Status tracker */}
      {idx >= 0 && (
        <Card>
          <CardContent className="p-6">
            <ol className="grid grid-cols-4 gap-2">
              {STEPS.map((s, i) => {
                const done = i <= idx;
                return (
                  <li key={s.key} className="flex flex-col items-center text-center">
                    <span
                      className={`flex h-8 w-8 items-center justify-center rounded-full text-sm ${
                        done
                          ? 'bg-leaf-500 text-white'
                          : 'border bg-background text-muted-foreground'
                      }`}
                    >
                      {done ? '✓' : i + 1}
                    </span>
                    <span
                      className={`mt-2 text-xs ${
                        done ? 'font-medium' : 'text-muted-foreground'
                      }`}
                    >
                      {s.label}
                    </span>
                  </li>
                );
              })}
            </ol>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Items</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {order.items.map((item) => (
                <li key={item.id} className="flex justify-between text-sm">
                  <span>
                    <span className="block font-medium">{item.title}</span>
                    <span className="text-xs text-muted-foreground">
                      SKU {item.sku} · × {item.quantity} · {formatINR(item.price)} ea
                    </span>
                  </span>
                  <span className="tabular-nums">{formatINR(item.total)}</span>
                </li>
              ))}
            </ul>
            <hr className="my-4" />
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between">
                <dt>Subtotal</dt>
                <dd className="tabular-nums">{formatINR(order.subtotal)}</dd>
              </div>
              {parseFloat(order.discount) > 0 && (
                <div className="flex justify-between text-leaf-600">
                  <dt>Discount{order.discountCode && ` (${order.discountCode})`}</dt>
                  <dd className="tabular-nums">−{formatINR(order.discount)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt>Shipping</dt>
                <dd className="tabular-nums">{formatINR(order.shipping)}</dd>
              </div>
              {parseFloat(order.codFee) > 0 && (
                <div className="flex justify-between">
                  <dt>COD fee</dt>
                  <dd className="tabular-nums">{formatINR(order.codFee)}</dd>
                </div>
              )}
              <div className="flex justify-between pt-2 text-base font-semibold">
                <dt>Total</dt>
                <dd className="tabular-nums">{formatINR(order.total)}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {order.shippingAddress && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Shipping</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">{order.shippingAddress.name}</p>
                <p>
                  {order.shippingAddress.addressLine}
                  {order.shippingAddress.landmark && `, ${order.shippingAddress.landmark}`}
                </p>
                <p>
                  {order.shippingAddress.city}, {stateName(order.shippingAddress.state)} —{' '}
                  {order.shippingAddress.pincode}
                </p>
                <p>{order.shippingAddress.phone}</p>
                {order.shippingAddress.trackingUrl && (
                  <Button asChild variant="outline" size="sm" className="mt-3">
                    <Link
                      href={order.shippingAddress.trackingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Track package
                    </Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Payment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p>
                <span className="text-muted-foreground">Method · </span>
                {order.paymentMethod === 'COD' ? 'Cash on delivery' : 'Online'}
              </p>
              <p>
                <span className="text-muted-foreground">Status · </span>
                {order.paymentStatus.toLowerCase()}
              </p>
              {order.paymentStatus === 'FAILED' && (
                <Button asChild variant="outline" size="sm" className="mt-2">
                  <Link href={`/pay/${order.id}`}>Retry payment</Link>
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
