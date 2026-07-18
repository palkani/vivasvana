'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { api } from '@/lib/api';
import { env } from '@/lib/env';
import type { Cart } from '@/lib/types';

interface Props {
  redirectTo: string;
}

// Three discrete screens — signin / signup-form / signup-otp. A discriminated
// state object keeps each screen's required fields type-safe.
type Step =
  | { kind: 'signin' }
  | { kind: 'signup' }
  | { kind: 'signup-otp'; email: string; expiresAt: string }
  | { kind: 'phone' }
  | { kind: 'phone-otp'; phone: string; expiresAt: string };

interface PhoneVerifyResponse {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string; phone: string; name: string | null };
}

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

  function handleGoogle() {
    setError(null);
    startTransition(async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        // Land on the shared callback, which exchanges the code, mirrors the
        // user, merges the guest cart, and forwards to `next`.
        const next = encodeURIComponent(redirectTo || '/account');
        const { error: err } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: `${env.siteUrl}/auth/callback?next=${next}` },
        });
        if (err) setError(err.message);
        // On success the browser navigates to Google — nothing else to do.
      } catch (err) {
        setError((err as Error).message);
      }
    });
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

  // ---------------- Phone-OTP login ----------------

  function requestPhoneOtp(resend = false) {
    setError(null);
    setInfo(null);
    startTransition(async () => {
      try {
        const res = await api.post<{ phone: string; expiresAt: string }>(
          '/api/auth/phone/request-otp',
          { phone: phone.trim() },
        );
        setStep({ kind: 'phone-otp', phone: res.phone, expiresAt: res.expiresAt });
        setOtp('');
        setInfo(
          resend
            ? `A fresh code is on its way to ${res.phone}.`
            : `We sent a 6-digit code to ${res.phone}. It expires in 10 minutes.`,
        );
      } catch (err) {
        setError(extractMessage(err) ?? 'Could not send the code.');
      }
    });
  }

  function handleRequestPhoneOtp(e: React.FormEvent) {
    e.preventDefault();
    requestPhoneOtp(false);
  }

  function handleVerifyPhone(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (step.kind !== 'phone-otp') return;
    const verifyPhone = step.phone;
    startTransition(async () => {
      try {
        const result = await api.post<PhoneVerifyResponse>('/api/auth/phone/verify', {
          phone: verifyPhone,
          code: otp,
        });
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
        setError(extractMessage(err) ?? 'Could not verify the code.');
      }
    });
  }

  // ---------------- Render ----------------

  if (step.kind === 'phone' || step.kind === 'phone-otp') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-center">
            {step.kind === 'phone' ? 'Sign in with mobile' : 'Enter the code'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {step.kind === 'phone' ? (
            <form onSubmit={handleRequestPhoneOtp} className="space-y-3">
              <p className="text-sm text-muted-foreground">
                We&rsquo;ll text a 6-digit code to your mobile number.
              </p>
              <label className="block space-y-1">
                <span className="text-sm font-medium">Mobile number</span>
                <Input
                  type="tel"
                  inputMode="numeric"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoComplete="tel"
                  placeholder="98765 43210"
                  required
                />
              </label>
              {error && (
                <p className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
                  {error}
                </p>
              )}
              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? 'Sending…' : 'Send code'}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerifyPhone} className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Enter the code sent to{' '}
                <span className="font-medium text-foreground">{step.phone}</span>.
              </p>
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
                {pending ? 'Verifying…' : 'Verify & sign in'}
              </Button>
              <div className="flex items-center justify-between pt-1 text-xs">
                <button
                  type="button"
                  onClick={() => requestPhoneOtp(true)}
                  disabled={pending}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Resend code
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStep({ kind: 'phone' });
                    setOtp('');
                    setError(null);
                    setInfo(null);
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Change number
                </button>
              </div>
            </form>
          )}
          <button
            type="button"
            onClick={() => {
              setStep({ kind: 'signin' });
              setError(null);
              setInfo(null);
            }}
            className="mt-4 w-full text-center text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back to email sign in
          </button>
        </CardContent>
      </Card>
    );
  }

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
        {env.googleAuthEnabled && (
          <>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleGoogle}
              disabled={pending}
            >
              <GoogleIcon />
              Continue with Google
            </Button>
            <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              or
              <span className="h-px flex-1 bg-border" />
            </div>
          </>
        )}
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
          {step.kind === 'signin' && (
            <div className="text-right">
              <Link
                href="/account/forgot-password"
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Forgot password?
              </Link>
            </div>
          )}
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
        {step.kind === 'signin' && (
          <>
            <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              or
              <span className="h-px flex-1 bg-border" />
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => {
                setStep({ kind: 'phone' });
                setError(null);
                setInfo(null);
              }}
              disabled={pending}
            >
              Sign in with mobile number
            </Button>
          </>
        )}
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

function GoogleIcon() {
  return (
    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}
