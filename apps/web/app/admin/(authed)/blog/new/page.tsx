import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BlogForm, EMPTY_BLOG } from '../_components/BlogForm';

export const metadata = {
  title: 'New post',
  robots: { index: false, follow: false },
};

export default function NewBlogPostPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Button asChild variant="ghost" size="sm" className="-ml-2 h-8 px-2 text-muted-foreground">
          <Link href="/admin/blog">
            <ArrowLeft className="mr-1 h-4 w-4" />
            All posts
          </Link>
        </Button>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">New blog post</h1>
        <p className="text-sm text-muted-foreground">
          Draft long-form content. Save as draft now, publish whenever you&rsquo;re ready.
        </p>
      </div>
      <BlogForm mode="create" initial={EMPTY_BLOG} />
    </div>
  );
}
