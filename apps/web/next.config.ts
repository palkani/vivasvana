import type { NextConfig } from 'next';

// Diagnostic: surface which NEXT_PUBLIC_* env vars Vercel injected at
// build time. Vercel scrubs values from logs by default; just printing
// the KEY NAMES lets us see whether SUPABASE_URL / SUPABASE_ANON_KEY
// actually reached the build. Remove once env wiring is stable.
const publicKeys = Object.keys(process.env)
  .filter((k) => k.startsWith('NEXT_PUBLIC_'))
  .sort();
const supabaseUrlPresent = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonPresent = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
// eslint-disable-next-line no-console
console.log('[vivasvana:build] NEXT_PUBLIC_* keys present:', publicKeys);
// eslint-disable-next-line no-console
console.log(
  '[vivasvana:build] NEXT_PUBLIC_SUPABASE_URL present:',
  supabaseUrlPresent,
  '· NEXT_PUBLIC_SUPABASE_ANON_KEY present:',
  supabaseAnonPresent,
);

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    typedRoutes: false,
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: 'placehold.co' },
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'http', hostname: '127.0.0.1' },
    ],
  },
  transpilePackages: ['@vivasvana/db'],
  // Same-origin proxy to the Railway API. Without this, every cart
  // fetch is cross-site (vercel.app → up.railway.app), the response
  // Set-Cookie is a third-party cookie, and modern browsers (Chrome
  // w/ Privacy Sandbox, Safari ITP, Firefox TCP) drop it silently.
  // Net effect: cart session never persists, "added to cart" succeeds
  // but the next GET /api/cart finds an empty bag.
  //
  // With this rewrite, the browser only ever talks to vivasvana.vercel.app
  // for /api/* — Vercel's edge proxies to Railway. The Set-Cookie comes
  // back from a same-origin response, so the browser stores it as a
  // first-party cookie and sends it on every subsequent request.
  //
  // Server-side fetches (RSC, server actions) still hit Railway directly
  // via lib/api.ts since they're not subject to browser cookie policy.
  async rewrites() {
    const upstream = process.env.NEXT_PUBLIC_API_URL ?? '';
    if (!upstream || upstream.startsWith('http://localhost')) return [];
    return [
      { source: '/api/:path*', destination: `${upstream}/api/:path*` },
    ];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default config;
