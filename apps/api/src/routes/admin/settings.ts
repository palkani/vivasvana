import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { SettingsService } from '../../services/settings.service.js';

const Decimal2 = z.string().regex(/^\d+(\.\d{1,2})?$/, 'Must be a decimal');

const UpdateBody = z.object({
  store: z.object({
    name: z.string().trim().min(1).max(120),
    legalName: z.string().trim().max(200),
    supportEmail: z.string().trim().email(),
    supportPhone: z.string().trim().max(40),
    gstin: z.string().trim().max(20),
    address: z.string().trim().max(500),
    countryOfOrigin: z.string().trim().max(80),
  }),
  shipping: z.object({
    freeShippingThreshold: Decimal2,
    defaultShippingFee: Decimal2,
    codFee: Decimal2,
    codEnabled: z.boolean(),
    estimatedDeliveryDays: z.number().int().min(1).max(60),
  }),
  tax: z.object({
    defaultGstRate: Decimal2,
    pricesIncludeTax: z.boolean(),
  }),
  marketing: z.object({
    announcementBar: z.string().trim().max(280),
    announcementEnabled: z.boolean(),
    socialInstagram: z.string().trim().max(200),
    socialFacebook: z.string().trim().max(200),
    socialTwitter: z.string().trim().max(200),
    socialYoutube: z.string().trim().max(200),
  }),
  policies: z.object({
    returnsWindowDays: z.number().int().min(0).max(90),
    contactRecipientEmail: z.string().trim().email(),
  }),
});

export default async function adminSettingsRoutes(app: FastifyInstance) {
  const service = new SettingsService(app.prisma);

  app.register(async (admin) => {
    admin.addHook('preHandler', admin.requirePermission('manage_settings'));

    admin.get(
      '/api/admin/settings',
      {
        schema: {
          tags: ['admin', 'settings'],
          summary: 'Read current storefront settings (singleton)',
          security: [{ bearerAuth: [] }],
        },
      },
      async () => service.get(),
    );

    admin.put(
      '/api/admin/settings',
      {
        schema: {
          tags: ['admin', 'settings'],
          summary: 'Replace storefront settings (full payload)',
          body: UpdateBody,
          security: [{ bearerAuth: [] }],
        },
      },
      async (req) => service.update(req.body),
    );
  });

  // Public, anonymous read so the storefront can fetch the announcement bar
  // and shipping thresholds. Sensitive fields (gstin, address) are stripped.
  app.get(
    '/api/settings/public',
    {
      schema: {
        tags: ['settings'],
        summary: 'Public settings (announcement, free-shipping threshold, etc.)',
      },
    },
    async () => {
      const s = await service.get();
      return {
        store: { name: s.store.name, countryOfOrigin: s.store.countryOfOrigin },
        shipping: {
          freeShippingThreshold: s.shipping.freeShippingThreshold,
          codEnabled: s.shipping.codEnabled,
        },
        marketing: {
          announcementBar: s.marketing.announcementBar,
          announcementEnabled: s.marketing.announcementEnabled,
          socialInstagram: s.marketing.socialInstagram,
          socialFacebook: s.marketing.socialFacebook,
          socialTwitter: s.marketing.socialTwitter,
          socialYoutube: s.marketing.socialYoutube,
        },
      };
    },
  );
}
