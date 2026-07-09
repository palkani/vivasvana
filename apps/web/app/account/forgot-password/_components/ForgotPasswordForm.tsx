'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { env } from '@/lib/env';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        // The recovery link lands on our shared callback, which exchanges the
        // code for a session and forwards to the reset form.
        const redirectTo = `${env.siteUrl}/auth/callback?next=/account/reset-password`;
        const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo,
        });
        // Always show the same success state — never reveal whether an email
        // is registered (prevents account enumeration).
        if (err) console.warn('[forgot-password]', err.message);
        setSent(true);
      } catch (err) {
        setError((err as Error).message);
      }
    });
  }

  return (
    <div className="w-full max-w-sm rounded-lg border bg-card p-8">
      <h1 className="font-serif text-2xl font-semibold tracking-tight">Reset your password</h1>

      {sent ? (
        <div className="mt-4 space-y-4">
          <p className="rounded-md border border-leaf-200 bg-leaf-50 p-3 text-sm text-leaf-800">
            If an account exists for <strong>{email}</strong>, we&rsquo;ve sent a link to reset
            your password. Check your inbox (and spam).
          </p>
          <Button asChild variant="outline" className="w-full">
            <Link href="/account/login">Back to sign in</Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <p className="text-sm text-muted-foreground">
            Enter your email and we&rsquo;ll send you a link to set a new password.
          </p>
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>

          {error && (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? 'Sending…' : 'Send reset link'}
          </Button>

          <div className="text-center text-sm text-muted-foreground">
            <Link href="/account/login" className="hover:text-foreground">
              Back to sign in
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}
