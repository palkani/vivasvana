'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { Lock, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

interface Props {
  initialEmail: string;
  emailLocked: boolean;
}

const MAX_MESSAGE = 2000;
const MIN_MESSAGE = 10;
// Mirrors server filters so the user gets immediate feedback (server still
// enforces these — never trust client validation alone).
const HTML_INJECTION_RE =
  /<script\b|<iframe\b|<object\b|<embed\b|javascript:|onerror\s*=|onload\s*=|onclick\s*=|data:text\/html/i;
const URL_RE = /https?:\/\/|www\.[a-z]/gi;

export function ContactForm({ initialEmail, emailLocked }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState(initialEmail);
  const [phone, setPhone] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [website, setWebsite] = useState(''); // honeypot
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [pending, startTransition] = useTransition();
  const loadedAtRef = useRef<number>(Date.now());

  // Keep email in sync if the session loads after mount (rare but possible).
  useEffect(() => {
    if (emailLocked && initialEmail) setEmail(initialEmail);
  }, [emailLocked, initialEmail]);

  function validate(): string | null {
    if (!name.trim()) return 'Please enter your name.';
    if (!email.trim()) return 'Please enter your email.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Please enter a valid email.';
    const m = message.trim();
    if (m.length < MIN_MESSAGE) return `Message must be at least ${MIN_MESSAGE} characters.`;
    if (m.length > MAX_MESSAGE) return `Message is too long (max ${MAX_MESSAGE} characters).`;
    if (HTML_INJECTION_RE.test(m) || HTML_INJECTION_RE.test(name)) {
      return 'Please remove HTML or script tags from your message.';
    }
    const urls = m.match(URL_RE);
    if (urls && urls.length > 2) {
      return 'Please limit the number of links in your message.';
    }
    return null;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await api.post('/api/contact', {
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim() || undefined,
          subject: subject.trim() || undefined,
          message: message.trim(),
          website, // honeypot
          loadedAt: loadedAtRef.current,
        });
        setSubmitted(true);
      } catch (e) {
        const err = e as { payload?: { message?: string }; message?: string };
        setError(err.payload?.message ?? err.message ?? 'Could not send. Please try again.');
      }
    });
  }

  if (submitted) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
          <CheckCircle2 className="h-10 w-10 text-leaf-600" aria-hidden />
          <h2 className="font-serif text-xl font-semibold">Thanks for reaching out</h2>
          <p className="text-sm text-muted-foreground">
            We&rsquo;ve received your message and will reply within one business day.
          </p>
        </CardContent>
      </Card>
    );
  }

  const charsLeft = MAX_MESSAGE - message.length;

  return (
    <Card>
      <CardContent className="p-6 md:p-8">
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {/* Honeypot — hidden from real users, visible to dumb bots.
              Wrapper is aria-hidden + tab-out + visually offscreen. */}
          <div
            aria-hidden="true"
            tabIndex={-1}
            style={{
              position: 'absolute',
              left: '-9999px',
              width: '1px',
              height: '1px',
              overflow: 'hidden',
            }}
          >
            <label>
              Do not fill this field:
              <input
                type="text"
                name="website"
                autoComplete="off"
                tabIndex={-1}
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-sm font-medium">
                Name <span className="text-destructive">*</span>
              </span>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={120}
                autoComplete="name"
              />
            </label>

            <label className="space-y-1">
              <span className="flex items-center gap-1.5 text-sm font-medium">
                Email <span className="text-destructive">*</span>
                {emailLocked && (
                  <span
                    className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-1.5 py-0.5 text-[10px] font-medium text-brand-800"
                    title="Linked to your account"
                  >
                    <Lock className="h-2.5 w-2.5" aria-hidden /> account
                  </span>
                )}
              </span>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                readOnly={emailLocked}
                maxLength={254}
                autoComplete="email"
                className={cn(emailLocked && 'cursor-not-allowed bg-muted/40')}
              />
              {emailLocked && (
                <span className="text-xs text-muted-foreground">
                  We&rsquo;ll reply to your account email. Sign out to use a different one.
                </span>
              )}
            </label>
          </div>

          <label className="block space-y-1">
            <span className="text-sm font-medium">Phone</span>
            <Input
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={20}
              autoComplete="tel"
              placeholder="Optional"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-medium">Subject</span>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={200}
              placeholder="Optional"
            />
          </label>

          <label className="block space-y-1">
            <span className="flex items-center justify-between text-sm font-medium">
              <span>
                Message <span className="text-destructive">*</span>
              </span>
              <span
                className={cn(
                  'text-xs tabular-nums',
                  charsLeft < 100 ? 'text-destructive' : 'text-muted-foreground',
                )}
              >
                {charsLeft} / {MAX_MESSAGE}
              </span>
            </span>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              minLength={MIN_MESSAGE}
              maxLength={MAX_MESSAGE}
              rows={6}
              className="w-full rounded-md border border-input bg-background p-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              placeholder="How can we help?"
            />
            <span className="text-xs text-muted-foreground">
              Plain text only — please avoid HTML, scripts, or multiple URLs.
            </span>
          </label>

          {error && (
            <p
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
            >
              {error}
            </p>
          )}

          <div className="flex items-center justify-between gap-3 pt-2">
            <p className="text-xs text-muted-foreground">
              By submitting you agree to our{' '}
              <a href="/policies/privacy-policy" className="underline">
                privacy policy
              </a>
              .
            </p>
            <Button type="submit" size="lg" disabled={pending}>
              {pending ? 'Sending…' : 'Send message'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
