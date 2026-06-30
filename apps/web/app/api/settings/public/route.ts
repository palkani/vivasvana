import { prisma } from '@vivasvana/db';
import { SettingsService } from '@/lib/server/services/settings.service';
import { route, json } from '@/lib/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Public, anonymous read so the storefront can fetch the announcement bar
// and shipping thresholds. Sensitive fields (gstin, address) are stripped.
export const GET = route(async () => {
  const service = new SettingsService(prisma);
  const s = await service.get();
  return json({
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
  });
});
