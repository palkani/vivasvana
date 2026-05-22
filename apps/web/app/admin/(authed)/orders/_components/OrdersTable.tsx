'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { adminApi } from '@/lib/admin-api';
import { formatINR, pluralize } from '@/lib/utils';
import { stateName } from '@/lib/india-states';
import type { OrderStatus, PaymentStatus, PaymentMethod } from '@/lib/types';

interface OrderRow {
  id: string;
  orderNumber: string;
  email: string;
  phone: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  total: string;
  currency: string;
  placedAt: string;
  items: Array<{ id: string; title: string; quantity: number }>;
  shippingAddress: {
    name: string;
    city: string;
    state: string;
    trackingNumber: string | null;
    carrier: string | null;
  } | null;
}

interface ListResponse {
  total: number;
  items: OrderRow[];
  page: number;
  pageSize: number;
}

const STATUS_OPTIONS: Array<{ value: OrderStatus | ''; label: string }> = [
  { value: '', label: 'All statuses' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'PACKED', label: 'Packed' },
  { value: 'SHIPPED', label: 'Shipped' },
  { value: 'DELIVERED', label: 'Delivered' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'RETURNED', label: 'Returned' },
  { value: 'REFUNDED', label: 'Refunded' },
];

const PAYMENT_STATUS_OPTIONS: Array<{ value: PaymentStatus | ''; label: string }> = [
  { value: '', label: 'All payments' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'PAID', label: 'Paid' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'REFUNDED', label: 'Refunded' },
  { value: 'PARTIAL_REFUNDED', label: 'Partial refund' },
];

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

export function OrdersTable() {
  const [data, setData] = useState<ListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<OrderStatus | ''>('');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | ''>('');
  const [page, setPage] = useState(1);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    setError(null);
    const params = new URLSearchParams({ page: String(page), pageSize: '20', sort: 'placedAt-desc' });
    if (status) params.set('status', status);
    if (paymentStatus) params.set('paymentStatus', paymentStatus);
    if (search) params.set('search', search);

    (async () => {
      try {
        const res = await adminApi.get<ListResponse>(`/api/admin/orders?${params.toString()}`);
        if (!cancelled) setData(res);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [page, status, paymentStatus, search]);

  function applySearch(e: React.FormEvent) {
    e.preventDefault();
    startTransition(() => {
      setPage(1);
      setSearch(searchInput.trim());
    });
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <form onSubmit={applySearch} className="flex flex-1 min-w-[260px] items-center gap-2">
            <div className="relative flex-1">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search order #, email, phone, tracking, name…"
                className="pl-8"
              />
            </div>
            <Button type="submit" variant="outline" size="sm" disabled={pending}>
              Search
            </Button>
            {search && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch('');
                  setSearchInput('');
                  setPage(1);
                }}
              >
                Clear
              </Button>
            )}
          </form>

          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as OrderStatus | '');
              setPage(1);
            }}
            className="h-9 rounded-md border bg-background px-2 text-sm"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          <select
            value={paymentStatus}
            onChange={(e) => {
              setPaymentStatus(e.target.value as PaymentStatus | '');
              setPage(1);
            }}
            className="h-9 rounded-md border bg-background px-2 text-sm"
          >
            {PAYMENT_STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <Card>
        <CardContent className="p-0">
          {!data ? (
            <p className="p-8 text-center text-sm text-muted-foreground">Loading orders…</p>
          ) : data.items.length === 0 ? (
            <p className="p-12 text-center text-sm text-muted-foreground">
              No orders match the current filters.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Order</th>
                    <th className="px-4 py-3 font-medium">Customer</th>
                    <th className="px-4 py-3 font-medium">Items</th>
                    <th className="px-4 py-3 font-medium">Payment</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 text-right font-medium">Total</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((order) => {
                    const itemCount = order.items.reduce((s, it) => s + it.quantity, 0);
                    const placed = new Date(order.placedAt);
                    return (
                      <tr key={order.id} className="border-b last:border-b-0 align-top">
                        <td className="px-4 py-3">
                          <Link
                            href={`/admin/orders/${order.id}`}
                            className="font-mono text-sm font-medium hover:text-primary"
                          >
                            {order.orderNumber}
                          </Link>
                          <div className="text-xs text-muted-foreground">
                            {placed.toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium">
                            {order.shippingAddress?.name ?? '—'}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {order.email}
                          </div>
                          {order.shippingAddress && (
                            <div className="text-xs text-muted-foreground">
                              {order.shippingAddress.city}, {stateName(order.shippingAddress.state)}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm">
                            {itemCount} {pluralize(itemCount, 'item')}
                          </div>
                          <div className="line-clamp-2 max-w-[200px] text-xs text-muted-foreground">
                            {order.items
                              .slice(0, 2)
                              .map((it) => `${it.title.split('|')[0]?.trim()} × ${it.quantity}`)
                              .join(' · ')}
                            {order.items.length > 2 && ` · +${order.items.length - 2}`}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-xs">
                            <span className="font-medium">{order.paymentMethod}</span>
                            <div className="text-muted-foreground">
                              {order.paymentStatus.toLowerCase().replace('_', ' ')}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={STATUS_VARIANT[order.status]}>
                            {order.status.toLowerCase()}
                          </Badge>
                          {order.shippingAddress?.trackingNumber && (
                            <div className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                              {order.shippingAddress.carrier} ·{' '}
                              {order.shippingAddress.trackingNumber}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-medium tabular-nums">
                          {formatINR(order.total)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button asChild variant="outline" size="sm">
                            <Link href={`/admin/orders/${order.id}`}>Open</Link>
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {data && data.items.length > 0 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-muted-foreground">
            {data.total} {pluralize(data.total, 'order')} · page {data.page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={data.page <= 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={data.page >= totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
