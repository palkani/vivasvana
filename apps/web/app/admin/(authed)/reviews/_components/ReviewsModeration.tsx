'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { adminApi } from '@/lib/admin-api';
import { pluralize } from '@/lib/utils';

type ReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

interface ReviewRow {
  id: string;
  authorName: string;
  rating: number;
  title: string | null;
  content: string;
  isVerifiedPurchase: boolean;
  status: ReviewStatus;
  createdAt: string;
  product: { id: string; title: string; slug: string } | null;
}

interface ListResponse {
  total: number;
  page: number;
  pageSize: number;
  items: ReviewRow[];
}

const STATUS_OPTIONS: Array<{ value: ReviewStatus | ''; label: string }> = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: '', label: 'All statuses' },
];

const STATUS_VARIANT: Record<ReviewStatus, 'default' | 'outline' | 'success' | 'secondary'> = {
  PENDING: 'secondary',
  APPROVED: 'success',
  REJECTED: 'outline',
};

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={
            n <= rating
              ? 'h-3.5 w-3.5 fill-amber-400 text-amber-400'
              : 'h-3.5 w-3.5 text-muted-foreground/30'
          }
          aria-hidden
        />
      ))}
    </span>
  );
}

export function ReviewsModeration() {
  const [data, setData] = useState<ListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<ReviewStatus | ''>('PENDING');
  const [page, setPage] = useState(1);
  const [, startTransition] = useTransition();
  const [actionPending, setActionPending] = useState<string | null>(null);

  function buildQuery() {
    const params = new URLSearchParams({ page: String(page), pageSize: '50' });
    if (status) params.set('status', status);
    return params.toString();
  }

  async function load() {
    setError(null);
    try {
      const res = await adminApi.get<ListResponse>(`/api/admin/reviews?${buildQuery()}`);
      setData(res);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const params = new URLSearchParams({ page: String(page), pageSize: '50' });
      if (status) params.set('status', status);
      try {
        const res = await adminApi.get<ListResponse>(`/api/admin/reviews?${params.toString()}`);
        if (!cancelled) setData(res);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [page, status]);

  function doAction(id: string, action: 'approve' | 'reject' | 'delete') {
    if (action === 'delete' && !confirm('Permanently delete this review?')) return;
    setActionPending(id);
    startTransition(async () => {
      try {
        if (action === 'delete') {
          await adminApi.del(`/api/admin/reviews/${id}`);
        } else {
          await adminApi.post(`/api/admin/reviews/${id}/${action}`);
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
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as ReviewStatus | '');
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
            <p className="p-8 text-center text-sm text-muted-foreground">Loading reviews…</p>
          ) : data.items.length === 0 ? (
            <p className="p-12 text-center text-sm text-muted-foreground">
              No reviews {status ? `with status ${status.toLowerCase()}` : ''} yet.
            </p>
          ) : (
            <ul className="divide-y">
              {data.items.map((r) => (
                <li key={r.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Stars rating={r.rating} />
                      <span className="text-sm font-medium">{r.authorName}</span>
                      {r.isVerifiedPurchase && (
                        <Badge variant="success">Verified purchase</Badge>
                      )}
                      <Badge variant={STATUS_VARIANT[r.status]}>{r.status.toLowerCase()}</Badge>
                    </div>
                    {r.title && <p className="text-sm font-medium">{r.title}</p>}
                    <p className="whitespace-pre-line text-sm text-muted-foreground">{r.content}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.product ? (
                        <Link href={`/products/${r.product.slug}`} className="hover:text-primary">
                          {r.product.title}
                        </Link>
                      ) : (
                        <span>Product removed</span>
                      )}
                      {' · '}
                      {new Date(r.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-1">
                    {r.status !== 'APPROVED' && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={actionPending === r.id}
                        onClick={() => doAction(r.id, 'approve')}
                      >
                        Approve
                      </Button>
                    )}
                    {r.status !== 'REJECTED' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={actionPending === r.id}
                        onClick={() => doAction(r.id, 'reject')}
                      >
                        Reject
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      disabled={actionPending === r.id}
                      onClick={() => doAction(r.id, 'delete')}
                    >
                      Delete
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {data && data.items.length > 0 && data.total > data.pageSize && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-muted-foreground">
            {data.total} {pluralize(data.total, 'review')} · page {data.page} of {totalPages}
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