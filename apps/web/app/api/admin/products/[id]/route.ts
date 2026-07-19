import { z } from 'zod';
import { prisma } from '@vivasvana/db';
import { ProductService } from '@/lib/server/services/product.service';
import { serializeMoney } from '@/lib/server/lib/decimal';
import { route, parseParams, parseBody, notFound, json } from '@/lib/server/http';
import { requirePermission } from '@/lib/server/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const slug = z
  .string()
  .min(2)
  .max(96)
  .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, 'lowercase, digits, and hyphens only');

const money = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, 'use a decimal string like "299.00"');

// Product images can be Supabase Storage URLs (absolute) OR bundled assets in
// /public (root-relative, e.g. "/products/nutri-millet/front.png"). Accept
// both — requiring an absolute URL rejected every seeded product on edit.
const imageRef = z
  .string()
  .min(1)
  .max(500)
  .refine(
    (v) => v.startsWith('/') || /^https?:\/\//i.test(v),
    'must be an absolute URL or a root-relative path',
  );

const ProductInput = z.object({
  slug,
  title: z.string().min(1).max(200),
  description: z.string().min(1),
  shortDescription: z.string().max(280).optional(),
  sku: z.string().min(1).max(64),
  hsnCode: z.string().default('1008'),
  price: money,
  salePrice: money.optional(),
  taxRate: money.default('5.00'),
  weight: z.coerce.number().min(0).optional(),
  stock: z.coerce.number().int().min(0).default(0),
  lowStockAt: z.coerce.number().int().min(0).default(10),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).default('PUBLISHED'),
  isVegan: z.boolean().default(true),
  isGlutenFree: z.boolean().default(false),
  metaTitle: z.string().max(200).optional(),
  metaDescription: z.string().max(320).optional(),
  ingredients: z.string().optional(),
  howToUse: z.string().optional(),
  allergens: z.string().optional(),
  images: z.array(imageRef).max(12).optional(),
});

const IdParam = z.object({ id: z.string().uuid() });

// Get a product by id (admin) — read scope.
export const GET = route(async (req, ctx) => {
  await requirePermission(req, 'view_products');
  const { id } = await parseParams(ctx, IdParam);
  const product = await prisma.product.findUnique({
    where: { id },
    include: { images: { orderBy: { sortOrder: 'asc' } }, variants: true },
  });
  if (!product) throw notFound('Product not found');
  return json(serializeMoney(product));
});

// Update a product (replaces image set if images[] provided) — write scope.
export const PUT = route(async (req, ctx) => {
  await requirePermission(req, 'manage_products');
  const { id } = await parseParams(ctx, IdParam);
  const { images, ...data } = await parseBody(req, ProductInput.partial());
  // Run as a transaction so an image swap is atomic with the update.
  const updated = await prisma.$transaction(async (tx) => {
    if (images !== undefined) {
      await tx.productImage.deleteMany({ where: { productId: id } });
      if (images.length > 0) {
        await tx.productImage.createMany({
          data: images.map((url, i) => ({
            productId: id,
            url,
            sortOrder: i,
          })),
        });
      }
    }
    return tx.product.update({
      where: { id },
      data,
      include: { images: { orderBy: { sortOrder: 'asc' } } },
    });
  });
  return json(serializeMoney(updated));
});

// Soft-delete (archive) a product — write scope.
export const DELETE = route(async (req, ctx) => {
  await requirePermission(req, 'manage_products');
  const { id } = await parseParams(ctx, IdParam);
  const service = new ProductService(prisma);
  await service.softDelete(id);
  return new Response(null, { status: 204 });
});
