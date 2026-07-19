'use client';

import { useEffect, useState } from 'react';
import { adminApi } from '@/lib/admin-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

type Status = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

interface Testimonial {
  id: string;
  name: string;
  location: string | null;
  content: string;
  rating: number;
  imageUrl: string | null;
  status: Status;
  sortOrder: number;
}

interface Draft {
  id?: string;
  name: string;
  location: string;
  content: string;
  rating: number;
  imageUrl: string;
  status: Status;
  sortOrder: number;
}

const EMPTY: Draft = {
  name: '',
  location: '',
  content: '',
  rating: 5,
  imageUrl: '',
  status: 'PUBLISHED',
  sortOrder: 0,
};

export function TestimonialsView() {
  const [items, setItems] = useState<Testimonial[]>([]);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const res = await adminApi.get<{ items: Testimonial[] }>('/api/admin/testimonials');
      setItems(res.items);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    load();
  }, []);

  function edit(t: Testimonial) {
    setError(null);
    setDraft({
      id: t.id,
      name: t.name,
      location: t.location ?? '',
      content: t.content,
      rating: t.rating,
      imageUrl: t.imageUrl ?? '',
      status: t.status,
      sortOrder: t.sortOrder,
    });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const body = {
      name: draft.name.trim(),
      location: draft.location.trim() || undefined,
      content: draft.content.trim(),
      rating: draft.rating,
      imageUrl: draft.imageUrl.trim() || undefined,
      status: draft.status,
      sortOrder: draft.sortOrder,
    };
    try {
      if (draft.id) {
        await adminApi.patch(`/api/admin/testimonials/${draft.id}`, body);
      } else {
        await adminApi.post('/api/admin/testimonials', body);
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
    if (!confirm('Delete this testimonial?')) return;
    try {
      await adminApi.del(`/api/admin/testimonials/${id}`);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <div className="space-y-3">
        {items.map((t) => (
          <div key={t.id} className="rounded-lg border p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">
                  {t.name}
                  {t.location ? <span className="text-muted-foreground"> · {t.location}</span> : null}
                </p>
                <p className="text-xs text-amber-600">{'★'.repeat(t.rating)}{'☆'.repeat(5 - t.rating)}</p>
              </div>
              <Badge variant={t.status === 'PUBLISHED' ? 'success' : 'secondary'}>{t.status.toLowerCase()}</Badge>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{t.content}</p>
            <div className="mt-2 flex gap-3">
              <button className="text-xs text-brand-600 hover:underline" onClick={() => edit(t)}>
                Edit
              </button>
              <button className="text-xs text-destructive hover:underline" onClick={() => remove(t.id)}>
                Delete
              </button>
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <p className="rounded-lg border p-6 text-center text-muted-foreground">No testimonials yet.</p>
        )}
      </div>

      <form onSubmit={save} className="h-fit space-y-3 rounded-lg border p-5">
        <h2 className="font-medium">{draft.id ? 'Edit testimonial' : 'New testimonial'}</h2>
        <div className="space-y-1">
          <label className="text-sm font-medium">Name</label>
          <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Location</label>
          <Input value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })} />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Content</label>
          <textarea
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            rows={4}
            value={draft.content}
            onChange={(e) => setDraft({ ...draft, content: e.target.value })}
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-sm font-medium">Rating</label>
            <select
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={draft.rating}
              onChange={(e) => setDraft({ ...draft, rating: Number(e.target.value) })}
            >
              {[5, 4, 3, 2, 1].map((r) => (
                <option key={r} value={r}>
                  {r} ★
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
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Image URL (optional)</label>
          <Input value={draft.imageUrl} onChange={(e) => setDraft({ ...draft, imageUrl: e.target.value })} />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Status</label>
          <select
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            value={draft.status}
            onChange={(e) => setDraft({ ...draft, status: e.target.value as Status })}
          >
            <option value="PUBLISHED">Published</option>
            <option value="DRAFT">Draft</option>
            <option value="ARCHIVED">Archived</option>
          </select>
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