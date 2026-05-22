'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { adminApi } from '@/lib/admin-api';
import { formatINR, pluralize } from '@/lib/utils';
import {
  DiscountForm,
  type DiscountFormValues,
  type DiscountType,
  type DiscountStatus,
  type ApplyTarget,
  type CustomerScope,
} from '../../_components/DiscountForm';

interface AdminDiscount {
  id: string;
  code: string;
  description: string | null;
  type: DiscountType;
  value: string;
  minOrderValue: string | null;
  maxDiscount: string | null;
  appliesTo: ApplyTarget;
  customerScope: CustomerScope;
  maxUses: number | null;
  maxUsesPerUser: number | null;
  usedCount: number;
  validFrom: string | null;
  validUntil: string | null;
  status: DiscountStatus;
  createdAt: string;
  updatedAt: string;
  stats: { paidUses: number; totalDiscounted: string; totalRevenue: string };
}

function toDateInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  // Adjust to local timezone so the date shown matches what the admin sees.
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 10);
}

function toFormValues(d: AdminDiscount): DiscountFormValues {
  return {
    id: d.id,
    code: d.code,
    description: d.description ?? '',
    type: d.type,
    value: parseFloat(d.value).toString(),
    minOrderValue: d.minOrderValue ?? '',
    maxDiscount: d.maxDiscount ?? '',
    appliesTo: d.appliesTo,
    customerScope: d.customerScope,
    maxUses: d.maxUses?.toString() ?? '',
    maxUsesPerUser: d.maxUsesPerUser?.toString() ?? '',
    validFrom: toDateInput(d.validFrom),
    validUntil: toDateInput(d.validUntil),
    status: d.status,
  };
}

export function AdminDiscountEditor({ discountId }: { discountId: string }) {
  const [discount, setDiscount] = useState<AdminDiscount | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const d = await adminApi.get<AdminDiscount>(`/api/admin/discounts/${discountId}`);
        if (!cancelled) setDiscount(d);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [discountId]);

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!discount) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Button asChild variant="ghost" size="sm" className="-ml-2 h-8 px-2 text-muted-foreground">
          <Link href="/admin/discounts">
            <ArrowLeft className="mr-1 h-4 w-4" />
            All discounts
          </Link>
        </Button>
        <div className="flex items-center gap-3">
          <h1 className="font-mono text-2xl font-semibold">{discount.code}</h1>
          <Badge variant={discount.status === 'ACTIVE' ? 'success' : 'outline'}>
            {discount.status.toLowerCase()}
          </Badge>
        </div>
        {discount.description && (
          <p className="text-sm text-muted-foreground">{discount.description}</p>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Performance</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-4">
          <Stat label="Total uses" value={`${discount.usedCount}`} sub={
            discount.maxUses !== null ? `of ${discount.maxUses} allowed` : 'no limit'
          } />
          <Stat
            label="Paid uses"
            value={`${discount.stats.paidUses}`}
            sub={pluralize(discount.stats.paidUses, 'order')}
          />
          <Stat
            label="Total discounted"
            value={formatINR(discount.stats.totalDiscounted)}
            sub="amount given away"
          />
          <Stat
            label="Revenue captured"
            value={formatINR(discount.stats.totalRevenue)}
            sub="from orders that used this code"
          />
        </CardContent>
      </Card>

      <DiscountForm mode="edit" initial={toFormValues(discount)} />
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
