/** Client-safe env. Only NEXT_PUBLIC_* values are exposed to the browser. */

// `??` only falls back on null/undefined, so an env var saved as an empty
// string (which Vercel allows) slips through and produces an invalid URL.
// Treat empty / whitespace-only as missing so dev defaults still apply.
function envOr(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
}

export const env = {
  apiUrl: envOr(process.env.NEXT_PUBLIC_API_URL, 'http://localhost:4000'),
  supabaseUrl: envOr(process.env.NEXT_PUBLIC_SUPABASE_URL, ''),
  supabaseAnonKey: envOr(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, ''),
  siteUrl: envOr(process.env.NEXT_PUBLIC_SITE_URL, 'http://localhost:3000'),
  razorpayKeyId: envOr(process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID, ''),
};

// One-shot startup log so every cold start clearly reports what reached
// the runtime. Logs key NAMES and presence flags only — never values.
// The first `[vivasvana:env]` line in Vercel's runtime log is enough to
// diagnose missing env vars without curling a diagnostic endpoint.
if (typeof window === 'undefined') {
  const present = {
    NEXT_PUBLIC_API_URL: env.apiUrl !== 'http://localhost:4000',
    NEXT_PUBLIC_SUPABASE_URL: env.supabaseUrl.length > 0,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: env.supabaseAnonKey.length > 0,
    NEXT_PUBLIC_SITE_URL: env.siteUrl !== 'http://localhost:3000',
    NEXT_PUBLIC_RAZORPAY_KEY_ID: env.razorpayKeyId.length > 0,
  };
  // Use console.info so it lands in Vercel's Info severity bucket, easy
  // to filter for in the Functions log viewer.
  // eslint-disable-next-line no-console
  console.info('[vivasvana:env] startup snapshot:', {
    runtime: 'server',
    presence: present,
    apiUrlHost: safeHost(env.apiUrl),
    supabaseUrlHost: safeHost(env.supabaseUrl),
    siteUrl: env.siteUrl,
  });
  if (!present.NEXT_PUBLIC_SUPABASE_URL || !present.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    // eslint-disable-next-line no-console
    console.error(
      '[vivasvana:env] FATAL — Supabase env vars missing. ' +
        'Set NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel ' +
        'Settings → Environment Variables, scoped to Production. Then redeploy.',
    );
  }
}

function safeHost(url: string): string {
  if (!url) return '(empty)';
  try {
    return new URL(url).host;
  } catch {
    return '(invalid)';
  }
}
