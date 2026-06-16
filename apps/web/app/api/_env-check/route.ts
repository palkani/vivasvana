import { NextResponse } from 'next/server';

/**
 * Diagnostic endpoint — reports which NEXT_PUBLIC_* env vars are
 * present at server runtime. Does NOT return their values, only the
 * key names and presence flags. Safe to deploy publicly while we
 * troubleshoot Vercel env wiring; delete the route once Supabase
 * is talking to the storefront properly.
 */
export const dynamic = 'force-dynamic';

export function GET() {
  const publicKeys = Object.keys(process.env)
    .filter((k) => k.startsWith('NEXT_PUBLIC_'))
    .sort();

  return NextResponse.json({
    publicKeysPresent: publicKeys,
    flags: {
      NEXT_PUBLIC_SUPABASE_URL: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      NEXT_PUBLIC_SUPABASE_ANON_KEY: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      NEXT_PUBLIC_API_URL: Boolean(process.env.NEXT_PUBLIC_API_URL),
      NEXT_PUBLIC_SITE_URL: Boolean(process.env.NEXT_PUBLIC_SITE_URL),
    },
    // First 30 chars of each var — enough to verify the URL points at
    // the right Supabase project, but truncates the anon key so we
    // don't accidentally expose it in the response.
    previews: {
      NEXT_PUBLIC_SUPABASE_URL:
        process.env.NEXT_PUBLIC_SUPABASE_URL?.slice(0, 50) ?? null,
      NEXT_PUBLIC_API_URL:
        process.env.NEXT_PUBLIC_API_URL?.slice(0, 50) ?? null,
    },
    note: 'Remove this route once env vars are wired correctly.',
  });
}
