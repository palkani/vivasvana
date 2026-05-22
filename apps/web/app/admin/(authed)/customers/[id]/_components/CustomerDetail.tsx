'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { adminApi } from '@/lib/admin-api';
import { formatINR, pluralize } from '@/lib/utils';
import { stateName } from '@/lib/india-states';
import type { OrderStatus, PaymentStatus, PaymentMethod } from '@/lib/types';

interface AdminAddress {
  id: string;
  name: string;
  phone: string;
  addressLine: string;
  landmark: string | null;
  city: string;
  state: string;
  pincode: string;
  country: string;
  isDefault: boolean;
}

interface AdminCustomerOrder {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  total: string;
  currency: string;
  placedAt: string;
  shippingAddress: { city: string; state: string } | null;
  _count: { items: number };
}

interface AdminCustomer {
  id: string;
  email: string;
  phone: string | null;
  name: string | null;
  role: string;
  gstin: string | null;
  createdAt: string;
  updatedAt: string;
  addresses: AdminAddress[];
  orders: AdminCustomerOrder[];
  stats: { totalOrders: number; paidOrders: number; lifetimeValue: string };
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

export function CustomerDetail({ customerId }: { customerId: string }) {
  const [customer, setCustomer] = useState<AdminCustomer | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const c = await adminApi.get<AdminCustomer>(`/api/admin/customers/${customerId}`);
        if (!cancelled) setCustomer(c);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [customerId]);

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!customer) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Button asChild variant="ghost" size="sm" className="-ml-2 h-8 px-2 text-muted-foreground">
          <Link href="/admin/customers">
            <ArrowLeft className="mr-1 h-4 w-4" />
            All customers
          </Link>
        </Button>
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="font-serif text-2xl font-semibold">{customer.name ?? customer.email}</h1>
          {customer.role !== 'CUSTOMER' && (
            <Badge variant="secondary">{customer.role.toLowerCase()}</Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {customer.email}
          {customer.phone && ` · ${customer.phone}`}
        </p>
        {customer.gstin && (
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            GSTIN {customer.gstin}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Account since{' '}
          {new Date(customer.createdAt).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lifetime stats</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Stat
            label="Total orders"
            value={`${customer.stats.totalOrders}`}
            sub={pluralize(customer.stats.totalOrders, 'order')}
          />
          <Stat
            label="Paid orders"
            value={`${customer.stats.paidOrders}`}
            sub="excludes cancelled / refunded"
          />
          <Stat label="Lifetime value" value={formatINR(customer.stats.lifetimeValue)} sub="net revenue" />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Order history</CardTitle>
            <p className="text-xs text-muted-foreground">Showing the most recent 50 orders.</p>
          </CardHeader>
          <CardContent className="p-0">
            {customer.orders.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">No orders placed yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 font-medium">Order</th>
                      <th className="px-4 py-2 font-medium">Status</th>
                      <th className="px-4 py-2 font-medium">Items</th>
                      <th className="px-4 py-2 text-right font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customer.orders.map((o) => (
                      <tr key={o.id} className="border-b last:border-b-0 align-top">
                        <td className="px-4 py-2">
                          <Link
                            href={`/admin/orders/${o.id}`}
                            className="font-mono text-sm font-medium hover:text-primary"
                          >
                            {o.orderNumber}
                          </Link>
                          <div className="text-xs text-muted-foreground">
                            {new Date(o.placedAt).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                            {o.shippingAddress &&
                              ` · ${o.shippingAddress.city}, ${stateName(o.shippingAddress.state)}`}
                          </div>
                        </td>
                        <td className="px-4 py-2">
                          <Badge variant={STATUS_VARIANT[o.status]}>{o.status.toLowerCase()}</Badge>
                          <div className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                            {o.paymentMethod} ·{' '}
                            {o.paymentStatus.toLowerCase().replace('_', ' ')}
                          </div>
                        </td>
                        <td className="px-4 py-2 text-xs">
                          {o._count.items} {pluralize(o._count.items, 'item')}
                        </td>
                        <td className="px-4 py-2 text-right font-medium tabular-nums">
                          {formatINR(o.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Addresses</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {customer.addresses.length === 0 ? (
              <p className="text-muted-foreground">No saved addresses.</p>
            ) : (
              customer.addresses.map((a) => (
                <div key={a.id} className="rounded-md border p-3">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{a.name}</p>
                    {a.isDefault && <Badge variant="outline">Default</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">{a.phone}</p>
                  <p className="mt-1 text-xs">
                    {a.addressLine}
                    {a.landmark && `, ${a.landmark}`}
                    <br />
                    {a.city}, {stateName(a.state)} — {a.pincode}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}
