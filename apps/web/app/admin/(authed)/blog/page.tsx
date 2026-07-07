import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { BlogTable } from './_components/BlogTable';

export const metadata = {
  title: 'Blog',
  robots: { index: false, follow: false },
};

export default function AdminBlogPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-semibold tracking-tight">Blog</h1>
          <p className="text-sm text-muted-foreground">
            Long-form content — drafts, scheduled posts, and published articles.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/blog/new">+ New post</Link>
        </Button>
      </div>
      <BlogTable />
    </div>
  );
}
