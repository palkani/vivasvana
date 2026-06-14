'use client';

import { useEffect, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { adminApi } from '@/lib/admin-api';

interface SiteSettingsData {
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
    freeShippingThreshold: string;
    defaultShippingFee: string;
    codFee: string;
    codEnabled: boolean;
    estimatedDeliveryDays: number;
  };
  tax: {
    defaultGstRate: string;
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

export function SettingsForm() {
  const [settings, setSettings] = useState<SiteSettingsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await adminApi.get<SiteSettingsData>('/api/admin/settings');
        if (!cancelled) setSettings(data);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function patch<S extends keyof SiteSettingsData>(
    section: S,
    updater: (s: SiteSettingsData[S]) => SiteSettingsData[S],
  ) {
    setSettings((cur) => (cur ? { ...cur, [section]: updater(cur[section]) } : cur));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setError(null);
    startTransition(async () => {
      try {
        const saved = await adminApi.put<SiteSettingsData>('/api/admin/settings', settings);
        setSettings(saved);
        setSavedAt(new Date());
      } catch (e) {
        const err = e as { payload?: { message?: string }; message?: string };
        setError(err.payload?.message ?? err.message ?? 'Save failed');
      }
    });
  }

  if (error && !settings) return <p className="text-sm text-destructive">{error}</p>;
  if (!settings) return <p className="text-sm text-muted-foreground">Loading settings…</p>;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {/* === Store identity ============================================ */}
      <section className="space-y-4 rounded-lg border bg-card p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Store identity
        </h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Display name">
            <Input
              value={settings.store.name}
              onChange={(e) => patch('store', (s) => ({ ...s, name: e.target.value }))}
              required
              maxLength={120}
            />
          </Field>
          <Field label="Legal entity">
            <Input
              value={settings.store.legalName}
              onChange={(e) => patch('store', (s) => ({ ...s, legalName: e.target.value }))}
              maxLength={200}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Support email">
            <Input
              type="email"
              value={settings.store.supportEmail}
              onChange={(e) => patch('store', (s) => ({ ...s, supportEmail: e.target.value }))}
              required
            />
          </Field>
          <Field label="Support phone">
            <Input
              type="tel"
              value={settings.store.supportPhone}
              onChange={(e) => patch('store', (s) => ({ ...s, supportPhone: e.target.value }))}
              maxLength={40}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="GSTIN">
            <Input
              value={settings.store.gstin}
              onChange={(e) =>
                patch('store', (s) => ({ ...s, gstin: e.target.value.toUpperCase() }))
              }
              maxLength={20}
              className="font-mono"
              placeholder="e.g. 33AABCV1234A1Z5"
            />
          </Field>
          <Field label="Country of origin">
            <Input
              value={settings.store.countryOfOrigin}
              onChange={(e) => patch('store', (s) => ({ ...s, countryOfOrigin: e.target.value }))}
              maxLength={80}
            />
          </Field>
        </div>

        <Field label="Registered address">
          <Textarea
            value={settings.store.address}
            onChange={(e) => patch('store', (s) => ({ ...s, address: e.target.value }))}
            rows={2}
            maxLength={500}
          />
        </Field>
      </section>

      {/* === Shipping ================================================== */}
      <section className="space-y-4 rounded-lg border bg-card p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Shipping
        </h2>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Free shipping threshold (₹)">
            <Input
              type="number"
              step="0.01"
              min="0"
              value={settings.shipping.freeShippingThreshold}
              onChange={(e) =>
                patch('shipping', (s) => ({ ...s, freeShippingThreshold: e.target.value }))
              }
              required
            />
          </Field>
          <Field label="Default shipping fee (₹)">
            <Input
              type="number"
              step="0.01"
              min="0"
              value={settings.shipping.defaultShippingFee}
              onChange={(e) =>
                patch('shipping', (s) => ({ ...s, defaultShippingFee: e.target.value }))
              }
              required
            />
          </Field>
          <Field label="Estimated delivery (days)">
            <Input
              type="number"
              min="1"
              max="60"
              value={settings.shipping.estimatedDeliveryDays}
              onChange={(e) =>
                patch('shipping', (s) => ({
                  ...s,
                  estimatedDeliveryDays: Number(e.target.value),
                }))
              }
              required
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="COD fee (₹)">
            <Input
              type="number"
              step="0.01"
              min="0"
              value={settings.shipping.codFee}
              onChange={(e) => patch('shipping', (s) => ({ ...s, codFee: e.target.value }))}
              required
            />
          </Field>
          <label className="flex items-center gap-2 text-sm pt-6">
            <input
              type="checkbox"
              checked={settings.shipping.codEnabled}
              onChange={(e) =>
                patch('shipping', (s) => ({ ...s, codEnabled: e.target.checked }))
              }
              className="h-4 w-4 rounded border"
            />
            <span className="font-medium">Cash on Delivery enabled</span>
          </label>
        </div>
      </section>

      {/* === Tax ======================================================= */}
      <section className="space-y-4 rounded-lg border bg-card p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Tax
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Default GST rate (%)">
            <Input
              type="number"
              step="0.01"
              min="0"
              value={settings.tax.defaultGstRate}
              onChange={(e) => patch('tax', (s) => ({ ...s, defaultGstRate: e.target.value }))}
              required
            />
            <span className="block text-xs text-muted-foreground">
              Applied only when a product doesn&rsquo;t set its own rate.
            </span>
          </Field>
          <label className="flex items-center gap-2 text-sm pt-6">
            <input
              type="checkbox"
              checked={settings.tax.pricesIncludeTax}
              onChange={(e) => patch('tax', (s) => ({ ...s, pricesIncludeTax: e.target.checked }))}
              className="h-4 w-4 rounded border"
            />
            <span className="font-medium">Catalog prices are GST-inclusive</span>
          </label>
        </div>
      </section>

      {/* === Marketing ================================================= */}
      <section className="space-y-4 rounded-lg border bg-card p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Marketing
        </h2>

        <Field label="Announcement bar text">
          <Input
            value={settings.marketing.announcementBar}
            onChange={(e) =>
              patch('marketing', (s) => ({ ...s, announcementBar: e.target.value }))
            }
            maxLength={280}
            placeholder="Free shipping on orders over ₹499 · GST inclusive pricing"
          />
        </Field>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={settings.marketing.announcementEnabled}
            onChange={(e) =>
              patch('marketing', (s) => ({ ...s, announcementEnabled: e.target.checked }))
            }
            className="h-4 w-4 rounded border"
          />
          <span className="font-medium">Show announcement bar at top of site</span>
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Instagram URL">
            <Input
              type="url"
              value={settings.marketing.socialInstagram}
              onChange={(e) =>
                patch('marketing', (s) => ({ ...s, socialInstagram: e.target.value }))
              }
              maxLength={200}
              placeholder="https://instagram.com/vivasvana"
            />
          </Field>
          <Field label="Facebook URL">
            <Input
              type="url"
              value={settings.marketing.socialFacebook}
              onChange={(e) =>
                patch('marketing', (s) => ({ ...s, socialFacebook: e.target.value }))
              }
              maxLength={200}
            />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Twitter / X URL">
            <Input
              type="url"
              value={settings.marketing.socialTwitter}
              onChange={(e) =>
                patch('marketing', (s) => ({ ...s, socialTwitter: e.target.value }))
              }
              maxLength={200}
            />
          </Field>
          <Field label="YouTube URL">
            <Input
              type="url"
              value={settings.marketing.socialYoutube}
              onChange={(e) =>
                patch('marketing', (s) => ({ ...s, socialYoutube: e.target.value }))
              }
              maxLength={200}
            />
          </Field>
        </div>
      </section>

      {/* === Policies ================================================== */}
      <section className="space-y-4 rounded-lg border bg-card p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Policies
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Returns window (days)">
            <Input
              type="number"
              min="0"
              max="90"
              value={settings.policies.returnsWindowDays}
              onChange={(e) =>
                patch('policies', (s) => ({
                  ...s,
                  returnsWindowDays: Number(e.target.value),
                }))
              }
              required
            />
          </Field>
          <Field label="Contact form recipient">
            <Input
              type="email"
              value={settings.policies.contactRecipientEmail}
              onChange={(e) =>
                patch('policies', (s) => ({ ...s, contactRecipientEmail: e.target.value }))
              }
              required
            />
          </Field>
        </div>
      </section>

      <div className="sticky bottom-0 flex items-center justify-between gap-3 rounded-md border bg-background/90 p-3 backdrop-blur">
        <p className="text-xs text-muted-foreground">
          {savedAt
            ? `Last saved ${savedAt.toLocaleTimeString('en-IN')}`
            : 'Changes take effect immediately on the storefront.'}
        </p>
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save settings'}
        </Button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="font-medium">{label}</span>
      {children}
    </label>
  );
}
