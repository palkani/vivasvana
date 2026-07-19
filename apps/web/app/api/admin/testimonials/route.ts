import { z } from 'zod';
import { prisma } from '@vivasvana/db';
import { TestimonialService } from '@/lib/server/services/testimonial.service';
import { route, parseBody, json } from '@/lib/server/http';
import { requirePermission } from '@/lib/server/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({
  name: z.string().trim().min(1).max(80),
  location: z.string().trim().max(80).optional(),
  content: z.string().trim().min(3).max(1000),
  rating: z.coerce.number().int().min(1).max(5).default(5),
  imageUrl: z.string().url().max(500).optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).default('PUBLISHED'),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

export const GET = route(async (req) => {
  await requirePermission(req, 'view_blog');
  return json({ items: await new TestimonialService(prisma).adminList() });
});

export const POST = route(async (req) => {
  await requirePermission(req, 'manage_blog');
  const body = await parseBody(req, Body);
  return json(await new TestimonialService(prisma).create(body), { status: 201 });
});
