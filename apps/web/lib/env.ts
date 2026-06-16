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
