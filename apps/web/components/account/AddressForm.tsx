'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { PincodeStatus } from '@/components/storefront/PincodeStatus';
import { CitySelect } from '@/components/storefront/CitySelect';
import { accountApi } from '@/lib/account-api';
import { INDIA_STATES } from '@/lib/india-states';
import { usePincodeLookup } from '@/lib/use-pincode-lookup';
import type { Address } from '@/lib/types';

interface Props {
  initial?: Partial<Address>;
  onSaved: (address: Address) => void;
  onCancel?: () => void;
}

const EMPTY = {
  name: '',
  phone: '',
  addressLine: '',
  landmark: '',
  city: '',
  state: '',
  pincode: '',
  isDefault: false,
};

export function AddressForm({ initial, onSaved, onCancel }: Props) {
  const [form, setForm] = useState({ ...EMPTY, ...(initial ?? {}) });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // PIN → city/state auto-fill (debounced, always overrides)
  const pinLookupState = usePincodeLookup(form.pincode, (r) => {
    setForm((prev) => ({ ...prev, city: r.city, state: r.stateCode }));
  });

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const payload = {
          ...form,
          landmark: form.landmark || undefined,
        };
        const saved = initial?.id
          ? await accountApi.put<Address>(`/api/addresses/${initial.id}`, payload)
          : await accountApi.post<Address>('/api/addresses', payload);
        onSaved(saved);
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  return (
    <Card>
      <CardContent className="p-6">
        <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Full name *</span>
            <Input
              required
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              autoComplete="name"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Mobile *</span>
            <Input
              required
              type="tel"
              inputMode="tel"
              value={form.phone}
              onChange={(e) => update('phone', e.target.value)}
              autoComplete="tel"
              placeholder="Phone number"
            />
          </label>

          <label className="flex flex-col gap-1 md:col-span-2">
            <span className="text-sm font-medium">Address line *</span>
            <Input
              required
              value={form.addressLine}
              onChange={(e) => update('addressLine', e.target.value)}
              autoComplete="address-line1"
              placeholder="House no., street, area"
            />
          </label>

          <label className="flex flex-col gap-1 md:col-span-2">
            <span className="text-sm font-medium">Landmark</span>
            <Input
              value={form.landmark}
              onChange={(e) => update('landmark', e.target.value)}
              placeholder="Nearby landmark (optional)"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">PIN code *</span>
            <Input
              required
              inputMode="numeric"
              maxLength={6}
              pattern="[1-9][0-9]{5}"
              value={form.pincode}
              onChange={(e) => update('pincode', e.target.value.replace(/\D/g, ''))}
              autoComplete="postal-code"
              placeholder="6-digit PIN"
            />
            <PincodeStatus state={pinLookupState} />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">City *</span>
            <CitySelect
              stateCode={form.state}
              value={form.city}
              onChange={(v) => update('city', v)}
            />
          </label>

          <label className="flex flex-col gap-1 md:col-span-2">
            <span className="text-sm font-medium">State *</span>
            <select
              required
              value={form.state}
              onChange={(e) => update('state', e.target.value)}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="">Select a state</option>
              {INDIA_STATES.map((s) => (
                <option key={s.code} value={s.code}>{s.name}</option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 md:col-span-2">
            <input
              type="checkbox"
              checked={form.isDefault}
              onChange={(e) => update('isDefault', e.target.checked)}
            />
            <span className="text-sm">Make this my default address</span>
          </label>

          {error && (
            <p className="md:col-span-2 rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
              {error}
            </p>
          )}

          <div className="flex gap-3 md:col-span-2">
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : initial?.id ? 'Save changes' : 'Save address'}
            </Button>
            {onCancel && (
              <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
                Cancel
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
