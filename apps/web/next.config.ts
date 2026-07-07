import type { NextConfig } from 'next';
import path from 'node:path';

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
  // Prisma on Vercel serverless:
  //  - Keep @prisma/client (and its generated engine) OUT of the bundler so
  //    the native query-engine .node binary is loaded from node_modules at
  //    runtime instead of being mangled by webpack/turbopack.
  //  - Trace from the monorepo root so Next's file tracer can see the
  //    pnpm-hoisted engine in the root `.pnpm` store, and force-include the
  //    Linux engine binaries into every function bundle. Without this the
  //    engine is silently dropped and Prisma throws
  //    PrismaClientInitializationError at runtime.
  serverExternalPackages: ['@prisma/client', 'prisma', '.prisma/client'],
  outputFileTracingRoot: path.join(process.cwd(), '..', '..'),
  outputFileTracingIncludes: {
    '/**': [
      '../../node_modules/.pnpm/@prisma+client*/node_modules/.prisma/client/*.node',
      '../../packages/db/node_modules/.prisma/client/*.node',
    ],
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
  // No proxy rewrite anymore: the API is served by this app's own route
  // handlers under app/api/**, so /api/* is already same-origin. Cart
  // Set-Cookie comes back first-party for free, and there's no Railway
  // upstream to forward to. (This is exactly the cross-site cookie problem
  // the old rewrite existed to work around — now structurally gone.)
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
