import { z } from 'zod';
import { prisma } from '@vivasvana/db';
import { SettingsService } from '@/lib/server/services/settings.service';
import { route, parseBody, json } from '@/lib/server/http';
import { requirePermission } from '@/lib/server/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

export const GET = route(async (req) => {
  await requirePermission(req, 'manage_settings');
  const service = new SettingsService(prisma);
  return json(await service.get());
});

export const PUT = route(async (req) => {
  await requirePermission(req, 'manage_settings');
  const body = await parseBody(req, UpdateBody);
  const service = new SettingsService(prisma);
  return json(await service.update(body));
});
