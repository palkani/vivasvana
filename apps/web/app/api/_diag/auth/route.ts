import { jwtVerify, decodeProtectedHeader } from 'jose';
import { NextResponse } from 'next/server';
import { prisma } from '@vivasvana/db';
import { env } from '@/lib/server/config/env';
import { supabaseAdmin } from '@/lib/server/integrations/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * TEMPORARY diagnostic — pinpoints why authed requests 401. Requires the
 * caller's own Bearer token, so it leaks nothing an attacker doesn't already
 * have. DELETE this route once auth is confirmed working.
 */
export async function GET(req: Request) {
  const header = req.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) {
    return NextResponse.json(
      { error: 'Call with header  Authorization: Bearer <your access token>' },
      { status: 400 },
    );
  }

  const out: Record<string, unknown> = {
    env: {
      SUPABASE_JWT_SECRET_present: Boolean(env.SUPABASE_JWT_SECRET),
      SUPABASE_JWT_SECRET_length: env.SUPABASE_JWT_SECRET?.length ?? 0,
      SUPABASE_URL: env.SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY_present: Boolean(env.SUPABASE_SERVICE_ROLE_KEY),
    },
  };

  try {
    out.tokenAlg = decodeProtectedHeader(token).alg;
  } catch {
    out.tokenAlg = 'undecodable';
  }

  // 1) Local HS256 verify with the shared secret
  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(env.SUPABASE_JWT_SECRET),
      { algorithms: ['HS256'], audience: 'authenticated' },
    );
    out.localVerify = 'OK';
    out.sub = payload.sub;
  } catch (e) {
    out.localVerify = `FAIL: ${(e as Error).message}`;
  }

  // 2) Supabase-validated fallback
  let sub = out.sub as string | undefined;
  try {
    const { data, error } = await supabaseAdmin().auth.getUser(token);
    if (error) out.supabaseVerify = `FAIL: ${error.message}`;
    else {
      out.supabaseVerify = 'OK';
      out.supabaseSub = data.user?.id;
      sub = sub ?? data.user?.id;
    }
  } catch (e) {
    out.supabaseVerify = `ERROR: ${(e as Error).message}`;
  }

  // 3) Does the mirror user row exist, and what role?
  if (sub) {
    const u = await prisma.user.findUnique({
      where: { id: sub },
      select: { id: true, email: true, role: true, deletedAt: true },
    });
    out.userRow = u ?? 'MISSING (would be lazily created as CUSTOMER)';
  }

  return NextResponse.json(out);
}
