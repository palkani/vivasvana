import { z } from 'zod';
import { prisma } from '@vivasvana/db';
import { CategoryService } from '@/lib/server/services/category.service';
import { route, parseBody, parseParams, json, notFound, conflict, badRequest } from '@/lib/server/http';
import { requirePermission } from '@/lib/server/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Params = z.object({ id: z.string().uuid() });
const Patch = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  slug: z.string().trim().max(80).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  parentId: z.string().uuid().nullable().optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
});

export const GET = route(async (req, ctx) => {
  await requirePermission(req, 'view_products');
  const { id } = await parseParams(ctx, Params);
  const cat = await new CategoryService(prisma).get(id);
  if (!cat) throw notFound('Category not found');
  return json(cat);
});

export const PATCH = route(async (req, ctx) => {
  await requirePermission(req, 'manage_products');
  const { id } = await parseParams(ctx, Params);
  const body = await parseBody(req, Patch);
  try {
    return json(await new CategoryService(prisma).update(id, body));
  } catch (e) {
    if (e instanceof Error && e.message === 'SLUG_TAKEN') throw conflict('A category with that slug already exists.');
    if (e instanceof Error && e.message === 'INVALID_PARENT') throw badRequest('A category cannot be its own parent.');
    throw e;
  }
});

export const DELETE = route(async (req, ctx) => {
  await requirePermission(req, 'manage_products');
  const { id } = await parseParams(ctx, Params);
  try {
    await new CategoryService(prisma).delete(id);
    return new Response(null, { status: 204 });
  } catch (e) {
    if (e instanceof Error && e.message === 'HAS_CHILDREN') throw conflict('Move or delete sub-categories first.');
    throw e;
  }
});
