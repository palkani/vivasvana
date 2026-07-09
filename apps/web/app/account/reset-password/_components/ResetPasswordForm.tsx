'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [pending, startTransition] = useTransition();

  // The shared /auth/callback already exchanged the recovery code for a
  // session before redirecting here. Confirm it landed — if not, the link
  // was invalid/expired and the user must request a fresh one.
  useEffect(() => {
    (async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        setHasSession(!!user);
      } catch {
        setHasSession(false);
      }
    })();
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    startTransition(async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const { error: err } = await supabase.auth.updateUser({ password });
        if (err) {
          setError(err.message);
          return;
        }
        setDone(true);
        setTimeout(() => {
          router.push('/account');
          router.refresh();
        }, 1200);
      } catch (err) {
        setError((err as Error).message);
      }
    });
  }

  return (
    <div className="w-full max-w-sm rounded-lg border bg-card p-8">
      <h1 className="font-serif text-2xl font-semibold tracking-tight">Set a new password</h1>

      {hasSession === false ? (
        <div className="mt-4 space-y-4">
          <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            This reset link is invalid or has expired. Please request a new one.
          </p>
          <Button asChild variant="outline" className="w-full">
            <Link href="/account/forgot-password">Request a new link</Link>
          </Button>
        </div>
      ) : done ? (
        <p className="mt-4 rounded-md border border-leaf-200 bg-leaf-50 p-3 text-sm text-leaf-800">
          Password updated. Taking you to your account…
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="password" className="text-sm font-medium">
              New password
            </label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="confirm" className="text-sm font-medium">
              Confirm new password
            </label>
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>

          {error && (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={pending || hasSession === null}>
            {pending ? 'Updating…' : 'Update password'}
          </Button>
        </form>
      )}
    </div>
  );
}
