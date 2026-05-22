'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { adminApi } from '@/lib/admin-api';
import { pluralize } from '@/lib/utils';

type BlogStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

interface BlogRow {
  id: string;
  slug: string;
  title: string;
  author: string;
  status: BlogStatus;
  publishedAt: string | null;
  updatedAt: string;
  createdAt: string;
  readingMinutes: number | null;
}

interface ListResponse {
  total: number;
  page: number;
  pageSize: number;
  items: BlogRow[];
}

const STATUS_VARIANT: Record<BlogStatus, 'default' | 'outline' | 'success' | 'secondary'> = {
  DRAFT: 'outline',
  PUBLISHED: 'success',
  ARCHIVED: 'secondary',
};

const STATUS_OPTIONS: Array<{ value: BlogStatus | ''; label: string }> = [
  { value: '', label: 'All statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PUBLISHED', label: 'Published' },
  { value: 'ARCHIVED', label: 'Archived' },
];

export function BlogTable() {
  const [data, setData] = useState<ListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<BlogStatus | ''>('');
  const [page, setPage] = useState(1);
  const [pending, startTransition] = useTransition();
  const [actionPending, setActionPending] = useState<string | null>(null);

  async function load() {
    const params = new URLSearchParams({ page: String(page), pageSize: '25' });
    if (search) params.set('search', search);
    if (status) params.set('status', status);
    try {
      const res = await adminApi.get<ListResponse>(`/api/admin/blog?${params.toString()}`);
      setData(res);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const params = new URLSearchParams({ page: String(page), pageSize: '25' });
      if (search) params.set('search', search);
      if (status) params.set('status', status);
      try {
        const res = await adminApi.get<ListResponse>(`/api/admin/blog?${params.toString()}`);
        if (!cancelled) {
          setData(res);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [page, search, status]);

  function applySearch(e: React.FormEvent) {
    e.preventDefault();
    startTransition(() => {
      setPage(1);
      setSearch(searchInput.trim());
    });
  }

  function doAction(id: string, action: 'publish' | 'unpublish' | 'archive' | 'delete', title: string) {
    const messages: Record<typeof action, string> = {
      publish: `Publish "${title}"? It will be visible at /blog immediately.`,
      unpublish: `Revert "${title}" to draft? It will be removed from the public blog.`,
      archive: `Archive "${title}"?`,
      delete: `Permanently delete "${title}"? This cannot be undone.`,
    };
    if (!confirm(messages[action])) return;

    setActionPending(id);
    startTransition(async () => {
      try {
        if (action === 'delete') {
          await adminApi.del(`/api/admin/blog/${id}`);
        } else {
          await adminApi.post(`/api/admin/blog/${id}/${action}`);
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
                placeholder="Search title, slug, author…"
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
              setStatus(e.target.value as BlogStatus | '');
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
            <p className="p-8 text-center text-sm text-muted-foreground">Loading posts…</p>
          ) : data.items.length === 0 ? (
            <p className="p-12 text-center text-sm text-muted-foreground">
              No posts yet. Click <span className="font-medium">+ New post</span> to write your first article.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Title</th>
                    <th className="px-4 py-3 font-medium">Author</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Updated</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((post) => (
                    <tr key={post.id} className="border-b last:border-b-0 align-top">
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/blog/${post.id}`}
                          className="font-medium hover:text-primary"
                        >
                          {post.title}
                        </Link>
                        <div className="font-mono text-xs text-muted-foreground">
                          /blog/{post.slug}
                          {post.readingMinutes && ` · ${post.readingMinutes} min read`}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs">{post.author}</td>
                      <td className="px-4 py-3">
                        <Badge variant={STATUS_VARIANT[post.status]}>
                          {post.status.toLowerCase()}
                        </Badge>
                        {post.publishedAt && (
                          <div className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                            {new Date(post.publishedAt).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {new Date(post.updatedAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Button asChild variant="outline" size="sm">
                            <Link href={`/admin/blog/${post.id}`}>Edit</Link>
                          </Button>
                          {post.status === 'PUBLISHED' ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={actionPending === post.id}
                              onClick={() => doAction(post.id, 'unpublish', post.title)}
                            >
                              Unpublish
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={actionPending === post.id}
                              onClick={() => doAction(post.id, 'publish', post.title)}
                            >
                              Publish
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            disabled={actionPending === post.id}
                            onClick={() => doAction(post.id, 'delete', post.title)}
                          >
                            Delete
                          </Button>
                        </div>
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
            {data.total} {pluralize(data.total, 'post')} · page {data.page} of {totalPages}
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
