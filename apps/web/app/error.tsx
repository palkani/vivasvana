'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

/**
 * App-level error boundary. Catches anything that throws during render in
 * a server or client component. We use it to:
 *   1. Log the error to the browser console with our prefix so it's easy
 *      to grep in Vercel's Functions log viewer.
 *   2. Show a friendly fallback with a Retry button instead of Next's
 *      generic "Internal Server Error" page.
 *
 * Server errors get a runtime digest hash in production — we surface it
 * so support can grep the Vercel log for the same digest.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('[vivasvana:error]', {
      message: error.message,
      digest: error.digest,
      stack: error.stack?.split('\n').slice(0, 5).join('\n'),
    });
  }, [error]);

  return (
    <div className="container flex min-h-[60vh] flex-col items-center justify-center gap-4 py-12 text-center">
      <h1 className="font-serif text-2xl font-semibold">Something went wrong</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        We hit an error rendering this page. Try refreshing — most issues clear themselves.
      </p>
      {error.digest && (
        <p className="text-xs text-muted-foreground">
          Reference: <code className="font-mono">{error.digest}</code>
        </p>
      )}
      <div className="flex gap-2">
        <Button onClick={() => reset()} variant="default">
          Try again
        </Button>
        <Button asChild variant="outline">
          <Link href="/">Go home</Link>
        </Button>
      </div>
    </div>
  );
}
