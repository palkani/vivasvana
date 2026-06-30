import { z } from 'zod';
import { prisma } from '@vivasvana/db';
import { ProductService } from '@/lib/server/services/product.service';
import { serializeMoney } from '@/lib/server/lib/decimal';
import { route, parseQuery, parseBody, json } from '@/lib/server/http';
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
  // Default PUBLISHED — matches the admin form's default + Shopify's "Active".
  // A product saved without an explicit choice should be sellable.
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).default('PUBLISHED'),
  isVegan: z.boolean().default(true),
  isGlutenFree: z.boolean().default(false),
  metaTitle: z.string().max(200).optional(),
  metaDescription: z.string().max(320).optional(),
  ingredients: z.string().optional(),
  howToUse: z.string().optional(),
  allergens: z.string().optional(),
  // Images: array of public URLs. Order = sortOrder (0 = cover).
  // On UPDATE this replaces the entire image set for the product.
  images: z.array(z.string().url()).max(12).optional(),
});

const AdminListQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(60).default(20),
  sort: z.enum(['newest', 'price-asc', 'price-desc', 'bestseller']).default('newest'),
  status: z.enum(['PUBLISHED', 'DRAFT', 'ARCHIVED']).optional(),
  search: z.string().optional(),
});

// List all products (any status) for admin — read scope.
export const GET = route(async (req) => {
  await requirePermission(req, 'view_products');
  const query = parseQuery(req, AdminListQuery);
  const service = new ProductService(prisma);
  const result = await service.list(query);
  return json(serializeMoney(result));
});

// Create a product — write scope.
export const POST = route(async (req) => {
  await requirePermission(req, 'manage_products');
  const { images, ...data } = await parseBody(req, ProductInput);
  const created = await prisma.product.create({
    data: {
      slug: data.slug,
      title: data.title,
      description: data.description,
      shortDescription: data.shortDescription,
      sku: data.sku,
      hsnCode: data.hsnCode,
      price: data.price,
      salePrice: data.salePrice,
      taxRate: data.taxRate,
      weight: data.weight,
      stock: data.stock,
      lowStockAt: data.lowStockAt,
      status: data.status,
      isVegan: data.isVegan,
      isGlutenFree: data.isGlutenFree,
      metaTitle: data.metaTitle,
      metaDescription: data.metaDescription,
      ingredients: data.ingredients,
      howToUse: data.howToUse,
      allergens: data.allergens,
      ...(images && images.length > 0
        ? {
            images: {
              create: images.map((url, i) => ({ url, sortOrder: i })),
            },
          }
        : {}),
    },
    include: { images: { orderBy: { sortOrder: 'asc' } } },
  });
  return json(serializeMoney(created), { status: 201 });
});
