'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

interface Props {
  /** Where to send the shopper after Supabase finishes the OAuth roundtrip. */
  redirectTo: string;
  /** Surfaces failures back to the parent so the form can render them. */
  onError: (message: string) => void;
}

// Add/remove providers here. Each entry's `key` matches Supabase's provider
// identifier — must be enabled in the QA / prod Supabase project's Auth →
// Providers panel for the button to actually do anything.
const PROVIDERS = [
  { key: 'google', label: 'Continue with Google', icon: GoogleMark },
  { key: 'github', label: 'Continue with GitHub', icon: GitHubMark },
] as const;
type ProviderKey = (typeof PROVIDERS)[number]['key'];

export function OAuthButtons({ redirectTo, onError }: Props) {
  // Track which provider is mid-redirect so we can disable the others.
  // Supabase navigates away on success so this state mostly matters for
  // the brief flash before the redirect lands; if the popup is closed
  // we reset it.
  const [busy, setBusy] = useState<ProviderKey | null>(null);

  async function signInWith(provider: ProviderKey) {
    setBusy(provider);
    try {
      const supabase = createSupabaseBrowserClient();
      // `redirectTo` here is where SUPABASE sends the browser after the
      // provider hands the code back. /auth/callback exchanges the code
      // for a session and then forwards the shopper to `next`.
      const callbackUrl = new URL('/auth/callback', window.location.origin);
      callbackUrl.searchParams.set('next', redirectTo);

      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: callbackUrl.toString(),
          // Force re-consent each time on Google so account-switch works
          // (skip the auto-pick of the last-used account).
          queryParams: provider === 'google' ? { prompt: 'select_account' } : undefined,
        },
      });
      if (error) {
        onError(error.message);
        setBusy(null);
      }
      // On success, the browser navigates to Supabase → provider → back.
      // No need to reset busy state.
    } catch (e) {
      onError((e as Error).message);
      setBusy(null);
    }
  }

  return (
    <div className="space-y-2">
      {PROVIDERS.map(({ key, label, icon: Icon }) => (
        <Button
          key={key}
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => signInWith(key)}
          disabled={busy !== null}
          aria-label={label}
        >
          <Icon className="mr-2 h-4 w-4" />
          {busy === key ? 'Redirecting…' : label}
        </Button>
      ))}
    </div>
  );
}

// --- Brand marks (inline SVG so we don't bloat with an icon dep) ----------

function GoogleMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.7 5.7 0 0 1-2.4 3.71v3.07h3.86c2.27-2.09 3.56-5.17 3.56-9.02Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.08 7.94-2.91l-3.86-3.07c-1.07.72-2.44 1.16-4.08 1.16-3.13 0-5.79-2.11-6.74-4.96H1.27v3.13C3.25 21.32 7.31 24 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.26 14.22a7.21 7.21 0 0 1 0-4.44V6.65H1.27a12 12 0 0 0 0 10.7l3.99-3.13Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.74c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.17 15.24 0 12 0 7.31 0 3.25 2.68 1.27 6.65l3.99 3.13C6.21 6.85 8.87 4.74 12 4.74Z"
      />
    </svg>
  );
}

function GitHubMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 0a12 12 0 0 0-3.79 23.4c.6.11.82-.26.82-.58v-2.03c-3.34.72-4.04-1.6-4.04-1.6-.55-1.4-1.34-1.77-1.34-1.77-1.1-.75.08-.74.08-.74 1.21.08 1.85 1.25 1.85 1.25 1.08 1.85 2.83 1.31 3.52 1 .11-.79.42-1.31.77-1.61-2.66-.3-5.46-1.33-5.46-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.53.12-3.18 0 0 1.01-.32 3.3 1.23a11.46 11.46 0 0 1 6.01 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.63-5.49 5.92.43.37.81 1.1.81 2.21v3.28c0 .32.22.7.83.58A12 12 0 0 0 12 0Z"
      />
    </svg>
  );
}
