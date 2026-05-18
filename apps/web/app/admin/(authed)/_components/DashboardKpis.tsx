'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { adminApi } from '@/lib/admin-api';
import { formatINR } from '@/lib/utils';

interface Summary {
  totalOrders: number;
  totalRevenue: string;
  averageOrderValue: string;
  totalItemsSold: number;
}

export function DashboardKpis() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await adminApi.get<Summary>('/api/admin/reports/summary?range=30d');
        if (!cancelled) setSummary(s);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
        {error}
      </p>
    );
  }

  const cells: Array<{ label: string; value: string }> = [
    { label: 'Revenue (30d)', value: summary ? formatINR(summary.totalRevenue) : '—' },
    {
      label: 'Orders (30d)',
      value: summary ? summary.totalOrders.toLocaleString('en-IN') : '—',
    },
    {
      label: 'Avg order value',
      value: summary ? formatINR(summary.averageOrderValue) : '—',
    },
    {
      label: 'Items sold',
      value: summary ? summary.totalItemsSold.toLocaleString('en-IN') : '—',
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cells.map((c) => (
        <Card key={c.label}>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {c.label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-serif text-2xl font-semibold tabular-nums">{c.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
