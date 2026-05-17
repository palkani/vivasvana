'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { api } from '@/lib/api';
import type { Cart } from '@/lib/types';

interface Props {
  redirectTo: string;
}

type Mode = 'signin' | 'signup';

export function AuthForm({ redirectTo }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const supabase = createSupabaseBrowserClient();
      const action =
        mode === 'signin'
          ? supabase.auth.signInWithPassword({ email, password })
          : supabase.auth.signUp({
              email,
              password,
              options: { data: { name } },
            });
      const { error: authErr, data } = await action;
      if (authErr) {
        setError(authErr.message);
        return;
      }

      // After successful auth, merge any guest cart into the user cart.
      // The server reads vv_cart_sid from the cookie, so we just need to
      // call /api/cart/merge with the same sessionId the guest used.
      try {
        const guestCookie = document.cookie
          .split(';')
          .map((c) => c.trim().split('='))
          .find(([k]) => k === 'vv_cart_sid');
        const sessionId = guestCookie?.[1];
        const token = data.session?.access_token;
        if (sessionId && token) {
          await api.post<Cart>('/api/cart/merge', { sessionId }, { accessToken: token });
        }
      } catch {
        // non-fatal — guest cart preserved client-side either way
      }

      router.push(redirectTo);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-center">
          {mode === 'signin' ? 'Sign in' : 'Create your account'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === 'signup' && (
            <label className="block space-y-1">
              <span className="text-sm font-medium">Name</span>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                required
              />
            </label>
          )}
          <label className="block space-y-1">
            <span className="text-sm font-medium">Email</span>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium">Password</span>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              required
              minLength={8}
            />
          </label>
          {error && (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </Button>
        </form>
        <button
          type="button"
          onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
          className="mt-4 w-full text-center text-sm text-muted-foreground hover:text-foreground"
        >
          {mode === 'signin'
            ? "Don't have an account? Sign up"
            : 'Already have an account? Sign in'}
        </button>
      </CardContent>
    </Card>
  );
}
