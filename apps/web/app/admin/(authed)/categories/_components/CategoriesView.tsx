'use client';

import { useEffect, useState } from 'react';
import { adminApi } from '@/lib/admin-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parentId: string | null;
  parentName: string | null;
  sortOrder: number;
  productCount: number;
}

interface Draft {
  id?: string;
  name: string;
  slug: string;
  description: string;
  parentId: string;
  sortOrder: number;
}

const EMPTY: Draft = { name: '', slug: '', description: '', parentId: '', sortOrder: 0 };

export function CategoriesView() {
  const [items, setItems] = useState<Category[]>([]);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const res = await adminApi.get<{ items: Category[] }>('/api/admin/categories');
      setItems(res.items);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    load();
  }, []);

  function edit(c: Category) {
    setError(null);
    setDraft({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description ?? '',
      parentId: c.parentId ?? '',
      sortOrder: c.sortOrder,
    });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const body = {
      name: draft.name.trim(),
      slug: draft.slug.trim() || undefined,
      description: draft.description.trim() || undefined,
      parentId: draft.parentId || undefined,
      sortOrder: draft.sortOrder,
    };
    try {
      if (draft.id) {
        await adminApi.patch(`/api/admin/categories/${draft.id}`, {
          ...body,
          description: draft.description.trim() || null,
          parentId: draft.parentId || null,
        });
      } else {
        await adminApi.post('/api/admin/categories', body);
      }
      setDraft(EMPTY);
      await load();
    } catch (err) {
      setError((err as { payload?: { message?: string } }).payload?.message ?? (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete this category?')) return;
    setError(null);
    try {
      await adminApi.del(`/api/admin/categories/${id}`);
      await load();
    } catch (err) {
      setError((err as { payload?: { message?: string } }).payload?.message ?? (err as Error).message);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <div className="rounded-lg border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-3">Name</th>
              <th className="p-3">Slug</th>
              <th className="p-3">Parent</th>
              <th className="p-3 text-right">Products</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id} className="border-b last:border-0">
                <td className="p-3 font-medium">{c.name}</td>
                <td className="p-3 text-muted-foreground">{c.slug}</td>
                <td className="p-3 text-muted-foreground">{c.parentName ?? '—'}</td>
                <td className="p-3 text-right tabular-nums">{c.productCount}</td>
                <td className="p-3 text-right">
                  <button className="mr-3 text-xs text-brand-600 hover:underline" onClick={() => edit(c)}>
                    Edit
                  </button>
                  <button className="text-xs text-destructive hover:underline" onClick={() => remove(c.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-muted-foreground">
                  No categories yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <form onSubmit={save} className="h-fit space-y-3 rounded-lg border p-5">
        <h2 className="font-medium">{draft.id ? 'Edit category' : 'New category'}</h2>
        <div className="space-y-1">
          <label className="text-sm font-medium">Name</label>
          <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Slug (optional)</label>
          <Input
            value={draft.slug}
            onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
            placeholder="auto from name"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Description</label>
          <Input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Parent</label>
          <select
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            value={draft.parentId}
            onChange={(e) => setDraft({ ...draft, parentId: e.target.value })}
          >
            <option value="">— none —</option>
            {items
              .filter((c) => c.id !== draft.id)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Sort order</label>
          <Input
            type="number"
            value={draft.sortOrder}
            onChange={(e) => setDraft({ ...draft, sortOrder: Number(e.target.value) || 0 })}
          />
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex gap-2">
          <Button type="submit" disabled={busy}>
            {busy ? 'Saving…' : draft.id ? 'Update' : 'Create'}
          </Button>
          {draft.id && (
            <Button type="button" variant="ghost" onClick={() => setDraft(EMPTY)}>
              Cancel
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}