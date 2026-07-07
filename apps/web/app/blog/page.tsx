import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { api } from '@/lib/api';

export const metadata: Metadata = {
  title: 'Blog — Vivasvana',
  description:
    'Mindful nourishment, millet recipes, and stories from Vivasvana — plant-based superfoods made in India.',
};

interface BlogListItem {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  featuredImage: string | null;
  author: string;
  publishedAt: string;
  readingMinutes: number | null;
}

interface BlogList {
  total: number;
  page: number;
  pageSize: number;
  items: BlogListItem[];
}

interface PageProps {
  searchParams: Promise<{ page?: string; q?: string }>;
}

export default async function BlogIndexPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? '1') || 1);

  const params = new URLSearchParams({ page: String(page), pageSize: '12' });
  if (sp.q) params.set('search', sp.q);

  let data: BlogList;
  try {
    data = await api.get<BlogList>(`/api/blog?${params.toString()}`, {
      next: { revalidate: 60 },
    });
  } catch {
    data = { total: 0, page, pageSize: 12, items: [] };
  }

  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));

  return (
    <div className="container py-12 md:py-16">
      <header className="mx-auto mb-10 max-w-2xl text-center">
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-brand-600">
          Stories &amp; recipes
        </p>
        <h1 className="mt-2 font-serif text-4xl font-semibold tracking-tight md:text-5xl">
          Vivasvana journal
        </h1>
        <p className="mt-3 text-muted-foreground">
          Notes on mindful nutrition, millet recipes, and the slow craft of plant-based eating.
        </p>
      </header>

      {data.items.length === 0 ? (
        <div className="mx-auto max-w-xl rounded-lg border bg-muted/40 p-12 text-center">
          <p className="text-lg">No posts published yet.</p>
          <p className="mt-2 text-sm text-muted-foreground">
            We&rsquo;re cooking up our first stories — check back soon.
          </p>
        </div>
      ) : (
        <ul className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {data.items.map((post) => (
            <li key={post.id}>
              <Link href={`/blog/${post.slug}`} className="group block">
                <div className="relative aspect-[16/10] w-full overflow-hidden rounded-lg bg-muted">
                  {post.featuredImage ? (
                    <Image
                      src={post.featuredImage}
                      alt={post.title}
                      fill
                      sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
                      className="object-cover transition group-hover:scale-[1.02]"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-3xl font-serif text-muted-foreground">
                      V
                    </div>
                  )}
                </div>
                <div className="mt-4">
                  <p className="text-xs text-muted-foreground">
                    {new Date(post.publishedAt).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                    {post.readingMinutes && ` · ${post.readingMinutes} min read`}
                  </p>
                  <h2 className="mt-1 font-serif text-xl font-semibold leading-snug group-hover:text-primary">
                    {post.title}
                  </h2>
                  {post.excerpt && (
                    <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
                      {post.excerpt}
                    </p>
                  )}
                  <p className="mt-3 text-xs uppercase tracking-wide text-muted-foreground">
                    by {post.author}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {data.total > data.pageSize && (
        <nav className="mt-12 flex items-center justify-center gap-4 text-sm">
          {page > 1 && (
            <Link
              href={`/blog?page=${page - 1}`}
              className="rounded-md border px-3 py-1.5 hover:bg-accent"
            >
              ← Newer posts
            </Link>
          )}
          <span className="text-muted-foreground">
            Page {data.page} of {totalPages}
          </span>
          {page < totalPages && (
            <Link
              href={`/blog?page=${page + 1}`}
              className="rounded-md border px-3 py-1.5 hover:bg-accent"
            >
              Older posts →
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
