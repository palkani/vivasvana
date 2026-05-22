'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { adminApi } from '@/lib/admin-api';

export type BlogStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export interface BlogFormValues {
  id?: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  featuredImage: string;
  author: string;
  authorBio: string;
  status: BlogStatus;
  publishedAt: string; // datetime-local
  metaTitle: string;
  metaDescription: string;
}

export const EMPTY_BLOG: BlogFormValues = {
  slug: '',
  title: '',
  excerpt: '',
  content: '',
  featuredImage: '',
  author: '',
  authorBio: '',
  status: 'DRAFT',
  publishedAt: '',
  metaTitle: '',
  metaDescription: '',
};

function toIsoOrNull(v: string): string | null {
  if (!v) return null;
  return new Date(v).toISOString();
}

function toPayload(v: BlogFormValues) {
  return {
    slug: v.slug.trim() || undefined,
    title: v.title.trim(),
    excerpt: v.excerpt.trim() || null,
    content: v.content,
    featuredImage: v.featuredImage.trim() || null,
    author: v.author.trim(),
    authorBio: v.authorBio.trim() || null,
    status: v.status,
    publishedAt: toIsoOrNull(v.publishedAt),
    metaTitle: v.metaTitle.trim() || null,
    metaDescription: v.metaDescription.trim() || null,
  };
}

interface Props {
  mode: 'create' | 'edit';
  initial: BlogFormValues;
}

export function BlogForm({ mode, initial }: Props) {
  const router = useRouter();
  const [v, setV] = useState<BlogFormValues>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function update<K extends keyof BlogFormValues>(k: K, val: BlogFormValues[K]) {
    setV((cur) => ({ ...cur, [k]: val }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (v.title.trim().length < 2) {
      setError('Title must be at least 2 characters');
      return;
    }
    if (v.content.trim().length < 10) {
      setError('Write at least a few lines of content before saving');
      return;
    }
    if (!v.author.trim()) {
      setError('Author name is required');
      return;
    }

    startTransition(async () => {
      try {
        if (mode === 'create') {
          const created = await adminApi.post<{ id: string }>('/api/admin/blog', toPayload(v));
          router.push(`/admin/blog/${created.id}`);
        } else {
          await adminApi.patch(`/api/admin/blog/${initial.id}`, toPayload(v));
          router.refresh();
        }
      } catch (e) {
        const err = e as { payload?: { message?: string }; message?: string };
        setError(err.payload?.message ?? err.message ?? 'Save failed');
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* === Content ============================================== */}
          <section className="space-y-4 rounded-lg border bg-card p-5">
            <label className="block space-y-1 text-sm">
              <span className="font-medium">Title</span>
              <Input
                value={v.title}
                onChange={(e) => update('title', e.target.value)}
                maxLength={220}
                required
              />
            </label>

            <label className="block space-y-1 text-sm">
              <span className="font-medium">Slug</span>
              <Input
                value={v.slug}
                onChange={(e) => update('slug', e.target.value)}
                placeholder="auto-generated from title if empty"
                maxLength={160}
                className="font-mono"
              />
              <span className="block text-xs text-muted-foreground">
                Public URL: <code>/blog/{v.slug || 'your-slug-here'}</code>
              </span>
            </label>

            <label className="block space-y-1 text-sm">
              <span className="font-medium">Excerpt</span>
              <Textarea
                value={v.excerpt}
                onChange={(e) => update('excerpt', e.target.value)}
                rows={2}
                maxLength={500}
                placeholder="A short summary shown on the blog index and social cards."
              />
            </label>

            <label className="block space-y-1 text-sm">
              <span className="font-medium">Content (Markdown)</span>
              <Textarea
                value={v.content}
                onChange={(e) => update('content', e.target.value)}
                rows={18}
                required
                className="font-mono text-xs"
                placeholder={
                  '# Heading 1\n\nIntro paragraph…\n\n## Section\n\n- Bullet one\n- Bullet two'
                }
              />
              <span className="block text-xs text-muted-foreground">
                Markdown is rendered on the public page. Use #/##/### for headings, * for lists, **bold**.
              </span>
            </label>

            <label className="block space-y-1 text-sm">
              <span className="font-medium">Featured image URL</span>
              <Input
                type="url"
                value={v.featuredImage}
                onChange={(e) => update('featuredImage', e.target.value)}
                placeholder="https://… or /blog/cover.jpg"
                maxLength={500}
              />
            </label>
          </section>

          {/* === SEO ================================================== */}
          <section className="space-y-4 rounded-lg border bg-card p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              SEO
            </h2>
            <label className="block space-y-1 text-sm">
              <span className="font-medium">Meta title</span>
              <Input
                value={v.metaTitle}
                onChange={(e) => update('metaTitle', e.target.value)}
                maxLength={200}
                placeholder="Falls back to title if empty"
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="font-medium">Meta description</span>
              <Textarea
                value={v.metaDescription}
                onChange={(e) => update('metaDescription', e.target.value)}
                rows={2}
                maxLength={300}
                placeholder="Falls back to excerpt if empty. Keep under 160 characters for Google."
              />
            </label>
          </section>
        </div>

        {/* ---- Sidebar -------------------------------------------- */}
        <div className="space-y-6">
          <section className="space-y-4 rounded-lg border bg-card p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Publishing
            </h2>

            <label className="block space-y-1 text-sm">
              <span className="font-medium">Status</span>
              <select
                value={v.status}
                onChange={(e) => update('status', e.target.value as BlogStatus)}
                className="h-9 w-full rounded-md border bg-background px-2 text-sm"
              >
                <option value="DRAFT">Draft</option>
                <option value="PUBLISHED">Published</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </label>

            <label className="block space-y-1 text-sm">
              <span className="font-medium">Publish at</span>
              <Input
                type="datetime-local"
                value={v.publishedAt}
                onChange={(e) => update('publishedAt', e.target.value)}
              />
              <span className="block text-xs text-muted-foreground">
                Leave empty to publish immediately when status flips to Published.
                Set a future date to schedule.
              </span>
            </label>

            {mode === 'edit' && v.status === 'PUBLISHED' && v.slug && (
              <Button asChild variant="outline" size="sm" className="w-full">
                <Link href={`/blog/${v.slug}`} target="_blank" rel="noopener">
                  View on site <ExternalLink className="ml-2 h-3.5 w-3.5" />
                </Link>
              </Button>
            )}
          </section>

          <section className="space-y-4 rounded-lg border bg-card p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Author
            </h2>
            <label className="block space-y-1 text-sm">
              <span className="font-medium">Name</span>
              <Input
                value={v.author}
                onChange={(e) => update('author', e.target.value)}
                maxLength={120}
                required
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="font-medium">Bio</span>
              <Textarea
                value={v.authorBio}
                onChange={(e) => update('authorBio', e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="One-line author intro shown beneath the post."
              />
            </label>
          </section>
        </div>
      </div>

      <div className="flex items-center justify-between border-t pt-4">
        <Badge variant={v.status === 'PUBLISHED' ? 'success' : 'outline'}>
          {v.status.toLowerCase()}
        </Badge>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/admin/blog')}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? 'Saving…' : mode === 'create' ? 'Create post' : 'Save changes'}
          </Button>
        </div>
      </div>
    </form>
  );
}
