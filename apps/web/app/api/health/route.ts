import { prisma } from '@vivasvana/db';
import { route, json } from '@/lib/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route(async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return json({ status: 'ok' as const, db: true });
  } catch {
    return json({ status: 'error' as const, db: false }, { status: 503 });
  }
});
