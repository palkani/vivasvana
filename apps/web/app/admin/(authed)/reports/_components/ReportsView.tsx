'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { adminApi } from '@/lib/admin-api';
import { formatINR, pluralize } from '@/lib/utils';
import { stateName } from '@/lib/india-states';

type Range = '30d' | '90d' | '365d' | 'all';

const RANGES: Array<{ value: Range; label: string }> = [
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: '365d', label: 'Last 365 days' },
  { value: 'all', label: 'All time' },
];

interface Summary {
  totalOrders: number;
  totalRevenue: string;
  averageOrderValue: string;
  totalItemsSold: number;
}

interface ProductRow {
  productId: string | null;
  title: string;
  sku: string;
  quantitySold: number;
  revenue: string;
  orderCount: number;
}

interface StateRow {
  state: string;
  orderCount: number;
  revenue: string;
  uniqueCustomers: number;
}

export function ReportsView() {
  const [range, setRange] = useState<Range>('30d');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [states, setStates] = useState<StateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const [s, p, st] = await Promise.all([
          adminApi.get<Summary>(`/api/admin/reports/summary?range=${range}`),
          adminApi.get<{ items: ProductRow[] }>(
            `/api/admin/reports/sales-by-product?range=${range}`,
          ),
          adminApi.get<{ items: StateRow[] }>(
            `/api/admin/reports/sales-by-state?range=${range}`,
          ),
        ]);
        if (cancelled) return;
        setSummary(s);
        setProducts(p.items);
        setStates(st.items);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [range]);

  const totalRevenue = states.reduce((acc, r) => acc + parseFloat(r.revenue), 0);
  const productTotal = products.reduce((acc, r) => acc + parseFloat(r.revenue), 0);

  return (
    <div className="space-y-6">
      {/* Range selector */}
      <div className="flex flex-wrap gap-2">
        {RANGES.map((r) => (
          <Button
            key={r.value}
            variant={range === r.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => setRange(r.value)}
          >
            {r.label}
          </Button>
        ))}
      </div>

      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Total revenue"
          value={summary ? formatINR(summary.totalRevenue) : '—'}
          loading={loading}
        />
        <Kpi
          label="Orders"
          value={summary ? summary.totalOrders.toLocaleString('en-IN') : '—'}
          loading={loading}
        />
        <Kpi
          label="Average order value"
          value={summary ? formatINR(summary.averageOrderValue) : '—'}
          loading={loading}
        />
        <Kpi
          label="Items sold"
          value={summary ? summary.totalItemsSold.toLocaleString('en-IN') : '—'}
          loading={loading}
        />
      </div>

      {/* Two-up: by product | by state */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Sales by product</CardTitle>
            <p className="text-xs text-muted-foreground">
              Ranked by revenue. Top 50.
            </p>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <p className="p-6 text-sm text-muted-foreground">Loading…</p>
            ) : products.length === 0 ? (
              <Empty label="No product sales in this range yet." />
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">Product</th>
                    <th className="px-4 py-2 text-right font-medium">Qty</th>
                    <th className="px-4 py-2 text-right font-medium">Orders</th>
                    <th className="px-4 py-2 text-right font-medium">Revenue</th>
                    <th className="px-4 py-2 text-right font-medium">Share</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => {
                    const share =
                      productTotal > 0 ? (parseFloat(p.revenue) / productTotal) * 100 : 0;
                    return (
                      <tr key={p.productId ?? p.sku} className="border-b last:border-b-0">
                        <td className="px-4 py-2.5">
                          <div className="font-medium">{p.title}</div>
                          <div className="text-xs text-muted-foreground">{p.sku}</div>
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{p.quantitySold}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{p.orderCount}</td>
                        <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                          {formatINR(p.revenue)}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                          {share.toFixed(1)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Sales by state</CardTitle>
            <p className="text-xs text-muted-foreground">Ranked by revenue.</p>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <p className="p-6 text-sm text-muted-foreground">Loading…</p>
            ) : states.length === 0 ? (
              <Empty label="No state-level sales in this range yet." />
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">State</th>
                    <th className="px-4 py-2 text-right font-medium">Orders</th>
                    <th className="px-4 py-2 text-right font-medium">Customers</th>
                    <th className="px-4 py-2 text-right font-medium">Revenue</th>
                    <th className="px-4 py-2 text-right font-medium">Share</th>
                  </tr>
                </thead>
                <tbody>
                  {states.map((s) => {
                    const share =
                      totalRevenue > 0 ? (parseFloat(s.revenue) / totalRevenue) * 100 : 0;
                    return (
                      <tr key={s.state} className="border-b last:border-b-0">
                        <td className="px-4 py-2.5">
                          <div className="font-medium">{stateName(s.state) || s.state}</div>
                          <div className="text-xs text-muted-foreground">{s.state}</div>
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{s.orderCount}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          {s.uniqueCustomers}{' '}
                          <span className="text-xs text-muted-foreground">
                            {pluralize(s.uniqueCustomers, 'cust')}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                          {formatINR(s.revenue)}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                          {share.toFixed(1)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Kpi({ label, value, loading }: { label: string; value: string; loading: boolean }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="font-serif text-2xl font-semibold tabular-nums">
          {loading ? '—' : value}
        </p>
      </CardContent>
    </Card>
  );
}

function Empty({ label }: { label: string }) {
  return <p className="p-8 text-center text-sm text-muted-foreground">{label}</p>;
}
