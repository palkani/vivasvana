import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ProductService } from '../../services/product.service.js';
import { serializeMoney } from '../../lib/decimal.js';

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

export default async function adminProductRoutes(app: FastifyInstance) {
  const service = new ProductService(app.prisma);

  // Read scope: SUPPORT / CONTENT_EDITOR / INVENTORY / MANAGER + ADMIN.
  app.register(async (admin) => {
    admin.addHook('preHandler', admin.requirePermission('view_products'));

    admin.get(
      '/api/admin/products',
      {
        schema: {
          tags: ['admin', 'products'],
          summary: 'List all products (any status) for admin',
          querystring: AdminListQuery,
          security: [{ bearerAuth: [] }],
        },
      },
      async (req) => {
        const result = await service.list(req.query);
        return serializeMoney(result);
      },
    );

    admin.get(
      '/api/admin/products/:id',
      {
        schema: {
          tags: ['admin', 'products'],
          summary: 'Get a product by id (admin)',
          params: z.object({ id: z.string().uuid() }),
          security: [{ bearerAuth: [] }],
        },
      },
      async (req, reply) => {
        const product = await app.prisma.product.findUnique({
          where: { id: req.params.id },
          include: { images: { orderBy: { sortOrder: 'asc' } }, variants: true },
        });
        if (!product) return reply.notFound('Product not found');
        return serializeMoney(product);
      },
    );

  });

  // Write scope: INVENTORY / MANAGER + ADMIN.
  app.register(async (admin) => {
    admin.addHook('preHandler', admin.requirePermission('manage_products'));

    admin.post(
      '/api/admin/products',
      {
        schema: {
          tags: ['admin', 'products'],
          summary: 'Create a product',
          body: ProductInput,
          security: [{ bearerAuth: [] }],
        },
      },
      async (req, reply) => {
        const { images, ...data } = req.body;
        const created = await app.prisma.product.create({
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
        return reply.status(201).send(serializeMoney(created));
      },
    );

    admin.put(
      '/api/admin/products/:id',
      {
        schema: {
          tags: ['admin', 'products'],
          summary: 'Update a product (replaces image set if images[] provided)',
          params: z.object({ id: z.string().uuid() }),
          body: ProductInput.partial(),
          security: [{ bearerAuth: [] }],
        },
      },
      async (req) => {
        const { images, ...data } = req.body;
        // Run as a transaction so an image swap is atomic with the update.
        const updated = await app.prisma.$transaction(async (tx) => {
          if (images !== undefined) {
            await tx.productImage.deleteMany({ where: { productId: req.params.id } });
            if (images.length > 0) {
              await tx.productImage.createMany({
                data: images.map((url, i) => ({
                  productId: req.params.id,
                  url,
                  sortOrder: i,
                })),
              });
            }
          }
          return tx.product.update({
            where: { id: req.params.id },
            data,
            include: { images: { orderBy: { sortOrder: 'asc' } } },
          });
        });
        return serializeMoney(updated);
      },
    );

    admin.delete(
      '/api/admin/products/:id',
      {
        schema: {
          tags: ['admin', 'products'],
          summary: 'Soft-delete (archive) a product',
          params: z.object({ id: z.string().uuid() }),
          security: [{ bearerAuth: [] }],
        },
      },
      async (req, reply) => {
        await service.softDelete(req.params.id);
        return reply.status(204).send();
      },
    );
  });
}
