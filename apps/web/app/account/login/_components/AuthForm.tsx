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

// Three discrete screens — signin / signup-form / signup-otp. A discriminated
// state object keeps each screen's required fields type-safe.
type Step =
  | { kind: 'signin' }
  | { kind: 'signup' }
  | { kind: 'signup-otp'; email: string; expiresAt: string };

interface SignupVerifyResponse {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string; name: string | null };
}

export function AuthForm({ redirectTo }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>({ kind: 'signin' });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function mergeGuestCart(accessToken: string) {
    try {
      // The guest session id is in the HttpOnly `vv_cart_sid` cookie, which
      // the browser sends automatically on this same-origin request and the
      // server reads itself. (JS can't read HttpOnly cookies, which is why the
      // old document.cookie approach always found nothing and lost the cart.)
      await api.post<Cart>('/api/cart/merge', {}, { accessToken });
    } catch {
      // Non-fatal — guest cart preserved client-side either way.
    }
  }

  function handleSignin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    startTransition(async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error: authErr } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (authErr) {
        setError(authErr.message);
        return;
      }
      const token = data.session?.access_token;
      if (token) await mergeGuestCart(token);
      router.push(redirectTo);
      router.refresh();
    });
  }

  function handleRequestSignupOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    startTransition(async () => {
      try {
        const res = await api.post<{ email: string; expiresAt: string }>(
          '/api/auth/signup/request-otp',
          {
            email,
            password,
            name: name.trim() || undefined,
            phone: phone.trim() || undefined,
          },
        );
        setStep({ kind: 'signup-otp', email: res.email, expiresAt: res.expiresAt });
        setInfo(`We sent a 6-digit code to ${res.email}. It expires in 10 minutes.`);
      } catch (err) {
        setError(extractMessage(err) ?? 'Could not start sign-up.');
      }
    });
  }

  function handleVerifySignup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (step.kind !== 'signup-otp') return;
    const verifyEmail = step.email;
    startTransition(async () => {
      try {
        const result = await api.post<SignupVerifyResponse>('/api/auth/signup/verify', {
          email: verifyEmail,
          code: otp,
          password,
          name: name.trim() || undefined,
        });
        // Drop the Supabase session into the browser client so subsequent
        // requests are authenticated. We use setSession so refresh tokens
        // are stored exactly the way signInWithPassword would have done.
        const supabase = createSupabaseBrowserClient();
        const { error: setErr } = await supabase.auth.setSession({
          access_token: result.accessToken,
          refresh_token: result.refreshToken,
        });
        if (setErr) {
          setError(setErr.message);
          return;
        }
        await mergeGuestCart(result.accessToken);
        router.push(redirectTo);
        router.refresh();
      } catch (err) {
        setError(extractMessage(err) ?? 'Could not verify code.');
      }
    });
  }

  function handleResendOtp() {
    setError(null);
    setInfo(null);
    startTransition(async () => {
      try {
        const res = await api.post<{ email: string; expiresAt: string }>(
          '/api/auth/signup/request-otp',
          {
            email,
            password,
            name: name.trim() || undefined,
            phone: phone.trim() || undefined,
          },
        );
        setStep({ kind: 'signup-otp', email: res.email, expiresAt: res.expiresAt });
        setInfo(`A fresh code is on its way to ${res.email}.`);
      } catch (err) {
        setError(extractMessage(err) ?? 'Could not resend code.');
      }
    });
  }

  // ---------------- Render ----------------

  if (step.kind === 'signup-otp') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-center">Check your inbox</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-center text-sm text-muted-foreground">
            We sent a 6-digit code to{' '}
            <span className="font-medium text-foreground">{step.email}</span>. Enter
            it below to finish creating your account.
          </p>
          <form onSubmit={handleVerifySignup} className="space-y-3">
            <label className="block space-y-1">
              <span className="text-sm font-medium">Verification code</span>
              <Input
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                autoComplete="one-time-code"
                placeholder="123456"
                className="text-center text-lg tracking-[0.5em] tabular-nums"
                required
              />
            </label>
            {info && (
              <p className="rounded-md border border-leaf-200 bg-leaf-50 p-2 text-xs text-leaf-800">
                {info}
              </p>
            )}
            {error && (
              <p className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={pending || otp.length !== 6}>
              {pending ? 'Verifying…' : 'Verify & create account'}
            </Button>
            <div className="flex items-center justify-between pt-1 text-xs">
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={pending}
                className="text-muted-foreground hover:text-foreground"
              >
                Resend code
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep({ kind: 'signup' });
                  setOtp('');
                  setError(null);
                  setInfo(null);
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                Change email
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-center">
          {step.kind === 'signin' ? 'Sign in' : 'Create your account'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={step.kind === 'signin' ? handleSignin : handleRequestSignupOtp}
          className="space-y-3"
        >
          {step.kind === 'signup' && (
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
          {step.kind === 'signup' && (
            <label className="block space-y-1">
              <span className="text-sm font-medium">
                Phone <span className="text-muted-foreground">(optional)</span>
              </span>
              <Input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoComplete="tel"
                placeholder="10-digit mobile number"
                inputMode="tel"
              />
              <span className="text-xs text-muted-foreground">
                We&rsquo;ll send order updates by SMS if you add a number.
              </span>
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
              autoComplete={step.kind === 'signin' ? 'current-password' : 'new-password'}
              required
              minLength={8}
            />
            {step.kind === 'signup' && (
              <span className="text-xs text-muted-foreground">At least 8 characters.</span>
            )}
          </label>
          {info && (
            <p className="rounded-md border border-leaf-200 bg-leaf-50 p-2 text-xs text-leaf-800">
              {info}
            </p>
          )}
          {error && (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending
              ? 'Please wait…'
              : step.kind === 'signin'
                ? 'Sign in'
                : 'Send verification code'}
          </Button>
        </form>
        <button
          type="button"
          onClick={() => {
            setStep({ kind: step.kind === 'signin' ? 'signup' : 'signin' });
            setError(null);
            setInfo(null);
          }}
          className="mt-4 w-full text-center text-sm text-muted-foreground hover:text-foreground"
        >
          {step.kind === 'signin'
            ? "Don't have an account? Sign up"
            : 'Already have an account? Sign in'}
        </button>
      </CardContent>
    </Card>
  );
}

function extractMessage(err: unknown): string | null {
  if (!err || typeof err !== 'object') return null;
  const e = err as { payload?: { message?: string }; message?: string };
  return e.payload?.message ?? e.message ?? null;
}
