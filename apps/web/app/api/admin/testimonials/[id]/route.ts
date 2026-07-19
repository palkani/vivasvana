import { z } from 'zod';
import { prisma } from '@vivasvana/db';
import { TestimonialService } from '@/lib/server/services/testimonial.service';
import { route, parseBody, parseParams, json } from '@/lib/server/http';
import { requirePermission } from '@/lib/server/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Params = z.object({ id: z.string().uuid() });
const Patch = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  location: z.string().trim().max(80).nullable().optional(),
  content: z.string().trim().min(3).max(1000).optional(),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  imageUrl: z.string().url().max(500).nullable().optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
});

export const PATCH = route(async (req, ctx) => {
  await requirePermission(req, 'manage_blog');
  const { id } = await parseParams(ctx, Params);
  const body = await parseBody(req, Patch);
  return json(await new TestimonialService(prisma).update(id, body));
});

export const DELETE = route(async (req, ctx) => {
  await requirePermission(req, 'manage_blog');
  const { id } = await parseParams(ctx, Params);
  await new TestimonialService(prisma).delete(id);
  return new Response(null, { status: 204 });
});
