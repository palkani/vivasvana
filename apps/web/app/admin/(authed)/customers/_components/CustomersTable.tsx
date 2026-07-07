'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { adminApi } from '@/lib/admin-api';
import { formatINR, pluralize } from '@/lib/utils';

interface CustomerRow {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  gstin: string | null;
  createdAt: string;
  stats: {
    totalOrders: number;
    paidOrders: number;
    lifetimeValue: string;
    lastOrderAt: string | null;
  };
}

interface ListResponse {
  total: number;
  page: number;
  pageSize: number;
  items: CustomerRow[];
}

type Sort = 'createdAt-desc' | 'createdAt-asc' | 'spend-desc' | 'orders-desc' | 'name-asc';

const SORT_OPTIONS: Array<{ value: Sort; label: string }> = [
  { value: 'createdAt-desc', label: 'Newest first' },
  { value: 'createdAt-asc', label: 'Oldest first' },
  { value: 'spend-desc', label: 'Highest spenders' },
  { value: 'orders-desc', label: 'Most orders' },
  { value: 'name-asc', label: 'Name A→Z' },
];

export function CustomersTable() {
  const [data, setData] = useState<ListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [hasOrders, setHasOrders] = useState(false);
  const [sort, setSort] = useState<Sort>('createdAt-desc');
  const [page, setPage] = useState(1);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    setError(null);
    const params = new URLSearchParams({ page: String(page), pageSize: '25', sort });
    if (search) params.set('search', search);
    if (hasOrders) params.set('hasOrders', 'true');

    (async () => {
      try {
        const res = await adminApi.get<ListResponse>(`/api/admin/customers?${params.toString()}`);
        if (!cancelled) setData(res);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [page, search, hasOrders, sort]);

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
                placeholder="Search by email, name, or phone…"
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
            value={sort}
            onChange={(e) => {
              setSort(e.target.value as Sort);
              setPage(1);
            }}
            className="h-9 rounded-md border bg-background px-2 text-sm"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={hasOrders}
              onChange={(e) => {
                setHasOrders(e.target.checked);
                setPage(1);
              }}
              className="h-4 w-4 rounded border"
            />
            With orders only
          </label>
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
            <p className="p-8 text-center text-sm text-muted-foreground">Loading customers…</p>
          ) : data.items.length === 0 ? (
            <p className="p-12 text-center text-sm text-muted-foreground">
              No customers match the current filters.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Customer</th>
                    <th className="px-4 py-3 font-medium">Joined</th>
                    <th className="px-4 py-3 font-medium">Orders</th>
                    <th className="px-4 py-3 text-right font-medium">Lifetime value</th>
                    <th className="px-4 py-3 font-medium">Last order</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((c) => (
                    <tr key={c.id} className="border-b last:border-b-0 align-top">
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/customers/${c.id}`}
                          className="font-medium hover:text-primary"
                        >
                          {c.name ?? '—'}
                        </Link>
                        <div className="text-xs text-muted-foreground">{c.email}</div>
                        {c.phone && (
                          <div className="text-xs text-muted-foreground">{c.phone}</div>
                        )}
                        {c.gstin && (
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                            GSTIN {c.gstin}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {new Date(c.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <div>
                          {c.stats.totalOrders} {pluralize(c.stats.totalOrders, 'order')}
                        </div>
                        <div className="text-muted-foreground">
                          {c.stats.paidOrders} paid
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums">
                        {formatINR(c.stats.lifetimeValue)}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {c.stats.lastOrderAt
                          ? new Date(c.stats.lastOrderAt).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/admin/customers/${c.id}`}>Open</Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {data && data.items.length > 0 && data.total > data.pageSize && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-muted-foreground">
            {data.total} {pluralize(data.total, 'customer')} · page {data.page} of {totalPages}
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
