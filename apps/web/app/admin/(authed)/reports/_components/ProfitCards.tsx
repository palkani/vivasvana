'use client';

import { useEffect, useState } from 'react';
import { adminApi } from '@/lib/admin-api';
import { formatINR } from '@/lib/utils';

interface ProfitData {
  profit: {
    revenue: string;
    cogs: string;
    grossProfit: string;
    marginPct: string;
    costCoveragePct: string;
  };
  inventory: {
    retailValue: string;
    costValue: string;
    lowStockCount: number;
    productCount: number;
  };
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export function ProfitCards() {
  const [data, setData] = useState<ProfitData | null>(null);

  useEffect(() => {
    adminApi
      .get<ProfitData>('/api/admin/reports/profit?range=30d')
      .then(setData)
      .catch(() => {});
  }, []);

  if (!data) return null;
  const { profit, inventory } = data;

  return (
    <div className="space-y-3">
      <h2 className="font-medium">Profit &amp; margin (last 30 days)</h2>
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Revenue" value={formatINR(profit.revenue)} />
        <Stat label="COGS" value={formatINR(profit.cogs)} sub={`${profit.costCoveragePct}% cost-covered`} />
        <Stat label="Gross profit" value={formatINR(profit.grossProfit)} />
        <Stat label="Margin" value={`${profit.marginPct}%`} />
      </div>
      <h2 className="pt-2 font-medium">Inventory value</h2>
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Retail value" value={formatINR(inventory.retailValue)} />
        <Stat label="Cost value" value={formatINR(inventory.costValue)} />
        <Stat label="Products" value={String(inventory.productCount)} />
        <Stat
          label="Low stock"
          value={String(inventory.lowStockCount)}
          sub={inventory.lowStockCount > 0 ? 'needs restock' : 'all healthy'}
        />
      </div>
    </div>
  );
}