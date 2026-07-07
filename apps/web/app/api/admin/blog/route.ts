import { z } from 'zod';
import { prisma } from '@vivasvana/db';
import { BlogService } from '@/lib/server/services/blog.service';
import { route, parseQuery, parseBody, json } from '@/lib/server/http';
import { requirePermission } from '@/lib/server/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ListQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(25),
  search: z.string().min(1).max(120).optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
});

const CreateBody = z.object({
  slug: z.string().trim().min(1).max(160).optional(),
  title: z.string().trim().min(2).max(220),
  excerpt: z.string().trim().max(500).optional().nullable(),
  content: z.string().min(1),
  featuredImage: z.string().trim().url().max(500).optional().nullable(),
  author: z.string().trim().min(1).max(120),
  authorBio: z.string().trim().max(500).optional().nullable(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
  publishedAt: z.coerce.date().optional().nullable(),
  readingMinutes: z.number().int().positive().optional().nullable(),
  metaTitle: z.string().trim().max(200).optional().nullable(),
  metaDescription: z.string().trim().max(300).optional().nullable(),
});

export const GET = route(async (req) => {
  await requirePermission(req, 'view_blog');
  const query = parseQuery(req, ListQuery);
  const service = new BlogService(prisma);
  return json(await service.adminList(query));
});

export const POST = route(async (req) => {
  await requirePermission(req, 'manage_blog');
  const body = await parseBody(req, CreateBody);
  const service = new BlogService(prisma);
  return json(await service.adminCreate(body), { status: 201 });
});
