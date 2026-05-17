'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { accountApi } from '@/lib/account-api';
import { formatINR, pluralize } from '@/lib/utils';
import type { Order, OrderStatus } from '@/lib/types';

interface ListResponse {
  items: Array<
    Pick<
      Order,
      'id' | 'orderNumber' | 'status' | 'paymentStatus' | 'paymentMethod' | 'total' | 'placedAt'
    > & {
      items: Array<{ id: string; title: string; quantity: number; price: string; total: string }>;
    }
  >;
  total: number;
}

const STATUS_VARIANT: Record<OrderStatus, 'default' | 'outline' | 'success' | 'secondary'> = {
  PENDING: 'outline',
  CONFIRMED: 'secondary',
  PACKED: 'secondary',
  SHIPPED: 'secondary',
  DELIVERED: 'success',
  CANCELLED: 'outline',
  RETURNED: 'outline',
  REFUNDED: 'outline',
};

export function OrdersList() {
  const [data, setData] = useState<ListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await accountApi.get<ListResponse>('/api/orders?pageSize=20');
        if (!cancelled) setData(res);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!data) return <p className="text-sm text-muted-foreground">Loading…</p>;

  if (data.items.length === 0) {
    return (
      <Card>
        <CardContent className="space-y-3 p-10 text-center">
          <p className="text-3xl">📦</p>
          <p className="text-lg">No orders yet</p>
          <p className="text-sm text-muted-foreground">
            Your future orders will appear here. Got a craving?
          </p>
          <Button asChild>
            <Link href="/products">Shop products</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <ul className="space-y-3">
      {data.items.map((order) => {
        const itemCount = order.items.reduce((s, it) => s + it.quantity, 0);
        return (
          <li key={order.id}>
            <Card>
              <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/account/orders/${order.id}`}
                      className="font-mono text-sm font-medium hover:text-primary"
                    >
                      {order.orderNumber}
                    </Link>
                    <Badge variant={STATUS_VARIANT[order.status]}>
                      {order.status.toLowerCase()}
                    </Badge>
                    {order.paymentMethod === 'COD' && (
                      <Badge variant="outline">COD</Badge>
                    )}
                  </div>
                  <p className="mt-1 truncate text-sm text-muted-foreground">
                    {order.items
                      .slice(0, 2)
                      .map((it) => `${it.title} × ${it.quantity}`)
                      .join(' · ')}
                    {order.items.length > 2 && ` · +${order.items.length - 2} more`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(order.placedAt).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}{' '}
                    · {itemCount} {pluralize(itemCount, 'item')}
                  </p>
                </div>
                <div className="flex items-center gap-4 sm:flex-col sm:items-end">
                  <p className="font-semibold tabular-nums">{formatINR(order.total)}</p>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/account/orders/${order.id}`}>View</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
