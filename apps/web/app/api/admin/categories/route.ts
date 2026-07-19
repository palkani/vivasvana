import { z } from 'zod';
import { prisma } from '@vivasvana/db';
import { CategoryService } from '@/lib/server/services/category.service';
import { route, parseBody, json, conflict, badRequest } from '@/lib/server/http';
import { requirePermission } from '@/lib/server/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({
  name: z.string().trim().min(1).max(80),
  slug: z.string().trim().max(80).optional(),
  description: z.string().trim().max(500).optional(),
  parentId: z.string().uuid().optional(),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

export const GET = route(async (req) => {
  await requirePermission(req, 'view_products');
  return json({ items: await new CategoryService(prisma).list() });
});

export const POST = route(async (req) => {
  await requirePermission(req, 'manage_products');
  const body = await parseBody(req, Body);
  try {
    return json(await new CategoryService(prisma).create(body), { status: 201 });
  } catch (e) {
    if (e instanceof Error && e.message === 'SLUG_TAKEN') throw conflict('A category with that slug already exists.');
    if (e instanceof Error && e.message === 'INVALID_SLUG') throw badRequest('Enter a valid name/slug.');
    throw e;
  }
});
