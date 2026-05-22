'use client';

import { useMemo, useState } from 'react';
import { Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export interface ShipmentBody {
  carrier: string;
  trackingNumber: string;
  trackingUrl?: string;
}

interface Props {
  /** 'ship' → POST /ship (carrier + tracking required). 'update' → PATCH /tracking (all optional). */
  mode: 'ship' | 'update';
  defaultCarrier?: string;
  defaultTrackingNumber?: string;
  defaultTrackingUrl?: string;
  disabled?: boolean;
  onSubmit: (body: ShipmentBody) => void;
}

const CARRIERS: Array<{ value: string; label: string; tplt?: (n: string) => string }> = [
  { value: 'Shiprocket', label: 'Shiprocket', tplt: (n) => `https://shiprocket.co/tracking/${n}` },
  { value: 'Delhivery', label: 'Delhivery', tplt: (n) => `https://www.delhivery.com/track/package/${n}` },
  { value: 'BlueDart', label: 'BlueDart', tplt: (n) => `https://www.bluedart.com/tracking?awb=${n}` },
  { value: 'DTDC', label: 'DTDC', tplt: (n) => `https://www.dtdc.in/tracking?awb=${n}` },
  { value: 'India Post', label: 'India Post', tplt: (n) => `https://www.indiapost.gov.in/_layouts/15/dop.portal.tracking/trackconsignment.aspx?id=${n}` },
  { value: 'Ekart', label: 'Ekart', tplt: (n) => `https://ekartlogistics.com/shipmenttrack/${n}` },
  { value: 'XpressBees', label: 'XpressBees', tplt: (n) => `https://www.xpressbees.com/track?awb=${n}` },
  { value: 'Other', label: 'Other (custom)' },
];

export function ShipmentForm({
  mode,
  defaultCarrier = '',
  defaultTrackingNumber = '',
  defaultTrackingUrl = '',
  disabled,
  onSubmit,
}: Props) {
  const [carrier, setCarrier] = useState(defaultCarrier || CARRIERS[0]!.value);
  const [trackingNumber, setTrackingNumber] = useState(defaultTrackingNumber);
  const [trackingUrl, setTrackingUrl] = useState(defaultTrackingUrl);
  const [urlTouched, setUrlTouched] = useState(Boolean(defaultTrackingUrl));

  const suggestedUrl = useMemo(() => {
    const c = CARRIERS.find((x) => x.value === carrier);
    if (!c?.tplt || !trackingNumber.trim()) return '';
    return c.tplt(trackingNumber.trim());
  }, [carrier, trackingNumber]);

  const effectiveUrl = urlTouched ? trackingUrl : suggestedUrl;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const tn = trackingNumber.trim();
    if (mode === 'ship' && (!carrier || tn.length < 3)) return;
    onSubmit({
      carrier,
      trackingNumber: tn,
      trackingUrl: effectiveUrl.trim() || undefined,
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-md border border-brand-200 bg-brand-50/40 p-4"
    >
      <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-brand-800">
        <Truck className="h-3.5 w-3.5" />
        {mode === 'ship' ? 'Add tracking & mark as shipped' : 'Edit tracking info'}
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="font-medium">Carrier</span>
          <select
            value={carrier}
            onChange={(e) => setCarrier(e.target.value)}
            required={mode === 'ship'}
            className="h-9 w-full rounded-md border bg-background px-2 text-sm"
          >
            {CARRIERS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1 text-sm">
          <span className="font-medium">Tracking number</span>
          <Input
            value={trackingNumber}
            onChange={(e) => setTrackingNumber(e.target.value)}
            placeholder="e.g. SR123456789IN"
            required={mode === 'ship'}
            minLength={mode === 'ship' ? 3 : undefined}
            maxLength={120}
          />
        </label>
      </div>

      <label className="block space-y-1 text-sm">
        <span className="font-medium">
          Tracking URL <span className="text-muted-foreground">(optional — auto-filled where supported)</span>
        </span>
        <Input
          type="url"
          value={effectiveUrl}
          onChange={(e) => {
            setUrlTouched(true);
            setTrackingUrl(e.target.value);
          }}
          placeholder={suggestedUrl || 'https://…'}
          maxLength={500}
        />
        {!urlTouched && suggestedUrl && (
          <span className="block text-xs text-muted-foreground">
            Will use the auto-generated link above. Edit to override.
          </span>
        )}
      </label>

      <div className="flex gap-2 pt-1">
        <Button type="submit" disabled={disabled}>
          {mode === 'ship' ? 'Ship order' : 'Save tracking'}
        </Button>
      </div>
    </form>
  );
}
