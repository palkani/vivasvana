'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { adminApi } from '@/lib/admin-api';
import { formatINR } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface OrderRow {
  id: string;
  orderNumber: string;
  status: string;
  total: string;
  email: string;
  placedAt: string;
  shippingAddress?: { name: string | null } | null;
}

export function RecentOrders() {
  const [rows, setRows] = useState<OrderRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    adminApi
      .get<{ items: OrderRow[] }>('/api/admin/orders?pageSize=6&sort=placedAt-desc')
      .then((r) => {
        if (!cancelled) setRows(r.items ?? []);
      })
      .catch((e) => {
        if (!cancelled) setError((e as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (rows === null) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">No orders yet.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="py-2 pr-3">Order</th>
            <th className="pr-3">Customer</th>
            <th className="pr-3">Status</th>
            <th className="pr-3 text-right">Total</th>
            <th className="text-right">Placed</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((o) => (
            <tr key={o.id} className="border-t">
              <td className="py-2 pr-3">
                <Link
                  href={`/admin/orders/${o.id}`}
                  className="font-medium text-brand-600 hover:underline"
                >
                  {o.orderNumber}
                </Link>
              </td>
              <td className="pr-3">{o.shippingAddress?.name ?? o.email}</td>
              <td className="pr-3">
                <Badge variant={o.status === 'DELIVERED' ? 'success' : 'secondary'}>
                  {o.status.toLowerCase()}
                </Badge>
              </td>
              <td className="pr-3 text-right tabular-nums">{formatINR(o.total)}</td>
              <td className="text-right text-muted-foreground">
                {new Date(o.placedAt).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}