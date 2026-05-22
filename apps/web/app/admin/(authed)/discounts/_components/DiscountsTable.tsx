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

type DiscountType = 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_SHIPPING';
type DiscountStatus = 'ACTIVE' | 'EXPIRED' | 'DISABLED';

interface DiscountRow {
  id: string;
  code: string;
  description: string | null;
  type: DiscountType;
  value: string;
  minOrderValue: string | null;
  maxDiscount: string | null;
  maxUses: number | null;
  usedCount: number;
  status: DiscountStatus;
  validFrom: string | null;
  validUntil: string | null;
  createdAt: string;
  stats: { paidUses: number; totalDiscounted: string };
}

interface ListResponse {
  total: number;
  page: number;
  pageSize: number;
  items: DiscountRow[];
}

const STATUS_OPTIONS: Array<{ value: DiscountStatus | ''; label: string }> = [
  { value: '', label: 'All statuses' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'DISABLED', label: 'Disabled' },
  { value: 'EXPIRED', label: 'Expired' },
];

const TYPE_OPTIONS: Array<{ value: DiscountType | ''; label: string }> = [
  { value: '', label: 'All types' },
  { value: 'PERCENTAGE', label: 'Percentage' },
  { value: 'FIXED_AMOUNT', label: 'Fixed amount' },
  { value: 'FREE_SHIPPING', label: 'Free shipping' },
];

const STATUS_VARIANT: Record<DiscountStatus, 'default' | 'outline' | 'success' | 'secondary'> = {
  ACTIVE: 'success',
  DISABLED: 'outline',
  EXPIRED: 'outline',
};

function describeValue(d: DiscountRow): string {
  if (d.type === 'FREE_SHIPPING') return 'Free shipping';
  if (d.type === 'PERCENTAGE') {
    const cap = d.maxDiscount ? ` (max ${formatINR(d.maxDiscount)})` : '';
    return `${parseFloat(d.value)}% off${cap}`;
  }
  return `${formatINR(d.value)} off`;
}

export function DiscountsTable() {
  const [data, setData] = useState<ListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<DiscountStatus | ''>('');
  const [type, setType] = useState<DiscountType | ''>('');
  const [page, setPage] = useState(1);
  const [pending, startTransition] = useTransition();
  const [actionPending, setActionPending] = useState<string | null>(null);

  async function load() {
    setError(null);
    const params = new URLSearchParams({ page: String(page), pageSize: '50', sort: 'createdAt-desc' });
    if (status) params.set('status', status);
    if (type) params.set('type', type);
    if (search) params.set('search', search);
    try {
      const res = await adminApi.get<ListResponse>(`/api/admin/discounts?${params.toString()}`);
      setData(res);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const params = new URLSearchParams({ page: String(page), pageSize: '50', sort: 'createdAt-desc' });
      if (status) params.set('status', status);
      if (type) params.set('type', type);
      if (search) params.set('search', search);
      try {
        const res = await adminApi.get<ListResponse>(`/api/admin/discounts?${params.toString()}`);
        if (!cancelled) setData(res);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [page, status, type, search]);

  function applySearch(e: React.FormEvent) {
    e.preventDefault();
    startTransition(() => {
      setPage(1);
      setSearch(searchInput.trim());
    });
  }

  function doAction(id: string, path: string, confirmMsg: string) {
    if (!confirm(confirmMsg)) return;
    setActionPending(id);
    startTransition(async () => {
      try {
        if (path.startsWith('DELETE ')) {
          await adminApi.del(path.slice('DELETE '.length));
        } else {
          await adminApi.post(path);
        }
        await load();
      } catch (e) {
        const err = e as { payload?: { message?: string }; message?: string };
        setError(err.payload?.message ?? err.message ?? 'Action failed');
      } finally {
        setActionPending(null);
      }
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
                placeholder="Search code or description…"
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
              setStatus(e.target.value as DiscountStatus | '');
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
            value={type}
            onChange={(e) => {
              setType(e.target.value as DiscountType | '');
              setPage(1);
            }}
            className="h-9 rounded-md border bg-background px-2 text-sm"
          >
            {TYPE_OPTIONS.map((o) => (
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
            <p className="p-8 text-center text-sm text-muted-foreground">Loading discounts…</p>
          ) : data.items.length === 0 ? (
            <p className="p-12 text-center text-sm text-muted-foreground">
              No discount codes yet. Click <span className="font-medium">+ New discount</span> to create one.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Code</th>
                    <th className="px-4 py-3 font-medium">Offer</th>
                    <th className="px-4 py-3 font-medium">Validity</th>
                    <th className="px-4 py-3 font-medium">Usage</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((d) => {
                    const now = new Date();
                    const expired =
                      d.validUntil && new Date(d.validUntil) < now ? true : false;
                    return (
                      <tr key={d.id} className="border-b last:border-b-0 align-top">
                        <td className="px-4 py-3">
                          <Link
                            href={`/admin/discounts/${d.id}`}
                            className="font-mono text-sm font-medium hover:text-primary"
                          >
                            {d.code}
                          </Link>
                          {d.description && (
                            <div className="line-clamp-1 max-w-[200px] text-xs text-muted-foreground">
                              {d.description}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm">{describeValue(d)}</div>
                          {d.minOrderValue && (
                            <div className="text-xs text-muted-foreground">
                              Min order {formatINR(d.minOrderValue)}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {d.validFrom ? (
                            <div>
                              From{' '}
                              {new Date(d.validFrom).toLocaleDateString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </div>
                          ) : (
                            <div>No start date</div>
                          )}
                          {d.validUntil ? (
                            <div className={expired ? 'text-destructive' : ''}>
                              Until{' '}
                              {new Date(d.validUntil).toLocaleDateString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </div>
                          ) : (
                            <div>Never expires</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          <div>
                            {d.usedCount} {pluralize(d.usedCount, 'use')}
                            {d.maxUses !== null && ` / ${d.maxUses}`}
                          </div>
                          <div className="text-muted-foreground">
                            {d.stats.paidUses} paid · {formatINR(d.stats.totalDiscounted)} discounted
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={STATUS_VARIANT[d.status]}>
                            {d.status.toLowerCase()}
                          </Badge>
                          {expired && d.status === 'ACTIVE' && (
                            <div className="mt-1 text-[10px] uppercase tracking-wide text-destructive">
                              Past end date
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-1">
                            <Button asChild variant="outline" size="sm">
                              <Link href={`/admin/discounts/${d.id}`}>Edit</Link>
                            </Button>
                            {d.status === 'ACTIVE' ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={actionPending === d.id}
                                onClick={() =>
                                  doAction(
                                    d.id,
                                    `/api/admin/discounts/${d.id}/archive`,
                                    `Disable code ${d.code}?`,
                                  )
                                }
                              >
                                Disable
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={actionPending === d.id}
                                onClick={() =>
                                  doAction(
                                    d.id,
                                    `/api/admin/discounts/${d.id}/activate`,
                                    `Re-activate code ${d.code}?`,
                                  )
                                }
                              >
                                Activate
                              </Button>
                            )}
                            {d.usedCount === 0 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                disabled={actionPending === d.id}
                                onClick={() =>
                                  doAction(
                                    d.id,
                                    `DELETE /api/admin/discounts/${d.id}`,
                                    `Permanently delete unused code ${d.code}?`,
                                  )
                                }
                              >
                                Delete
                              </Button>
                            )}
                          </div>
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

      {data && data.items.length > 0 && data.total > data.pageSize && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-muted-foreground">
            {data.total} {pluralize(data.total, 'discount')} · page {data.page} of {totalPages}
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
