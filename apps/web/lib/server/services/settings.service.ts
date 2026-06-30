import type { PrismaClient } from '@vivasvana/db';

/**
 * Singleton row storing storefront knobs the admin can edit at runtime.
 * Anything that needs to ship to *prod* (Razorpay keys, DB URL, etc) belongs
 * in env — this is for content/policy values that change without a redeploy.
 */

const SINGLETON_ID = 'default';

export interface SiteSettingsData {
  store: {
    name: string;
    legalName: string;
    supportEmail: string;
    supportPhone: string;
    gstin: string;
    address: string;
    countryOfOrigin: string;
  };
  shipping: {
    freeShippingThreshold: string; // INR string, e.g. "499.00"
    defaultShippingFee: string;
    codFee: string;
    codEnabled: boolean;
    estimatedDeliveryDays: number;
  };
  tax: {
    defaultGstRate: string; // e.g. "5.00"
    pricesIncludeTax: boolean;
  };
  marketing: {
    announcementBar: string;
    announcementEnabled: boolean;
    socialInstagram: string;
    socialFacebook: string;
    socialTwitter: string;
    socialYoutube: string;
  };
  policies: {
    returnsWindowDays: number;
    contactRecipientEmail: string;
  };
}

export const DEFAULT_SETTINGS: SiteSettingsData = {
  store: {
    name: 'Vivasvana',
    legalName: 'Vivasvana Foods Pvt Ltd',
    supportEmail: 'support@vivasvana.com',
    supportPhone: '',
    gstin: '',
    address: '',
    countryOfOrigin: 'India',
  },
  shipping: {
    freeShippingThreshold: '499.00',
    defaultShippingFee: '49.00',
    codFee: '40.00',
    codEnabled: true,
    estimatedDeliveryDays: 5,
  },
  tax: {
    defaultGstRate: '5.00',
    pricesIncludeTax: true,
  },
  marketing: {
    announcementBar: 'Free shipping on orders over ₹499 · GST inclusive pricing',
    announcementEnabled: true,
    socialInstagram: '',
    socialFacebook: '',
    socialTwitter: '',
    socialYoutube: '',
  },
  policies: {
    returnsWindowDays: 7,
    contactRecipientEmail: 'support@vivasvana.com',
  },
};

/** Deep-merge partial input on top of defaults so older rows pick up new keys. */
function mergeDefaults(stored: unknown): SiteSettingsData {
  if (!stored || typeof stored !== 'object') return DEFAULT_SETTINGS;
  const s = stored as Record<string, Record<string, unknown>>;
  return {
    store: { ...DEFAULT_SETTINGS.store, ...(s.store ?? {}) } as SiteSettingsData['store'],
    shipping: { ...DEFAULT_SETTINGS.shipping, ...(s.shipping ?? {}) } as SiteSettingsData['shipping'],
    tax: { ...DEFAULT_SETTINGS.tax, ...(s.tax ?? {}) } as SiteSettingsData['tax'],
    marketing: { ...DEFAULT_SETTINGS.marketing, ...(s.marketing ?? {}) } as SiteSettingsData['marketing'],
    policies: { ...DEFAULT_SETTINGS.policies, ...(s.policies ?? {}) } as SiteSettingsData['policies'],
  };
}

export class SettingsService {
  constructor(private readonly prisma: PrismaClient) {}

  async get(): Promise<SiteSettingsData> {
    const row = await this.prisma.siteSetting.findUnique({ where: { id: SINGLETON_ID } });
    if (!row) return DEFAULT_SETTINGS;
    return mergeDefaults(row.data);
  }

  async update(input: SiteSettingsData): Promise<SiteSettingsData> {
    const merged = mergeDefaults(input);
    await this.prisma.siteSetting.upsert({
      where: { id: SINGLETON_ID },
      create: { id: SINGLETON_ID, data: merged as object },
      update: { data: merged as object },
    });
    return merged;
  }
}
