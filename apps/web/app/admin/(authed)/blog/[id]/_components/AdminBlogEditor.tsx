'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { adminApi } from '@/lib/admin-api';
import { BlogForm, type BlogFormValues, type BlogStatus } from '../../_components/BlogForm';

interface AdminBlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content: string;
  featuredImage: string | null;
  author: string;
  authorBio: string | null;
  status: BlogStatus;
  publishedAt: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
}

function toDateTimeInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 16);
}

function toFormValues(p: AdminBlogPost): BlogFormValues {
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    excerpt: p.excerpt ?? '',
    content: p.content,
    featuredImage: p.featuredImage ?? '',
    author: p.author,
    authorBio: p.authorBio ?? '',
    status: p.status,
    publishedAt: toDateTimeInput(p.publishedAt),
    metaTitle: p.metaTitle ?? '',
    metaDescription: p.metaDescription ?? '',
  };
}

export function AdminBlogEditor({ postId }: { postId: string }) {
  const [post, setPost] = useState<AdminBlogPost | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await adminApi.get<AdminBlogPost>(`/api/admin/blog/${postId}`);
        if (!cancelled) setPost(p);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [postId]);

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!post) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Button asChild variant="ghost" size="sm" className="-ml-2 h-8 px-2 text-muted-foreground">
          <Link href="/admin/blog">
            <ArrowLeft className="mr-1 h-4 w-4" />
            All posts
          </Link>
        </Button>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">{post.title}</h1>
      </div>
      <BlogForm mode="edit" initial={toFormValues(post)} />
    </div>
  );
}
