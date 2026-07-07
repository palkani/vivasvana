import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { api } from '@/lib/api';
import { renderMarkdown } from '@/lib/markdown';

interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content: string;
  featuredImage: string | null;
  author: string;
  authorBio: string | null;
  publishedAt: string;
  readingMinutes: number | null;
  metaTitle: string | null;
  metaDescription: string | null;
}

interface PageProps {
  params: Promise<{ slug: string }>;
}

async function fetchPost(slug: string): Promise<BlogPost | null> {
  try {
    return await api.get<BlogPost>(`/api/blog/${encodeURIComponent(slug)}`, {
      next: { revalidate: 60 },
    });
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await fetchPost(slug);
  if (!post) return { title: 'Post not found' };
  return {
    title: post.metaTitle ?? `${post.title} — Vivasvana`,
    description: post.metaDescription ?? post.excerpt ?? undefined,
    openGraph: post.featuredImage
      ? { images: [{ url: post.featuredImage }] }
      : undefined,
  };
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = await fetchPost(slug);
  if (!post) notFound();

  return (
    <div className="container py-10 md:py-16">
      <Link
        href="/blog"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        All posts
      </Link>

      <article className="mx-auto mt-6 max-w-3xl">
        <header className="space-y-4">
          <p className="text-xs uppercase tracking-[0.22em] text-brand-600">
            {new Date(post.publishedAt).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
            {post.readingMinutes && ` · ${post.readingMinutes} min read`}
          </p>
          <h1 className="font-serif text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
            {post.title}
          </h1>
          {post.excerpt && (
            <p className="text-lg text-muted-foreground">{post.excerpt}</p>
          )}
          <p className="text-sm text-muted-foreground">by {post.author}</p>
        </header>

        {post.featuredImage && (
          <div className="relative mt-8 aspect-[16/9] w-full overflow-hidden rounded-xl bg-muted">
            <Image
              src={post.featuredImage}
              alt={post.title}
              fill
              priority
              sizes="(min-width: 768px) 768px, 100vw"
              className="object-cover"
            />
          </div>
        )}

        <div className="mt-8">{renderMarkdown(post.content)}</div>

        {post.authorBio && (
          <footer className="mt-12 rounded-xl border bg-muted/30 p-6">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              About the author
            </p>
            <p className="mt-1 font-serif text-lg font-semibold">{post.author}</p>
            <p className="mt-2 text-sm text-muted-foreground">{post.authorBio}</p>
          </footer>
        )}
      </article>
    </div>
  );
}
