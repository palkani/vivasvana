'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { adminApi } from '@/lib/admin-api';

export type DiscountType = 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_SHIPPING';
export type DiscountStatus = 'ACTIVE' | 'EXPIRED' | 'DISABLED';
export type ApplyTarget = 'ALL' | 'SPECIFIC_PRODUCTS' | 'SPECIFIC_CATEGORIES';
export type CustomerScope = 'ALL' | 'NEW_CUSTOMERS' | 'LOGGED_IN';

export interface DiscountFormValues {
  id?: string;
  code: string;
  description: string;
  type: DiscountType;
  value: string;
  minOrderValue: string;
  maxDiscount: string;
  appliesTo: ApplyTarget;
  customerScope: CustomerScope;
  maxUses: string;
  maxUsesPerUser: string;
  validFrom: string; // yyyy-mm-dd
  validUntil: string; // yyyy-mm-dd
  status: DiscountStatus;
}

export const EMPTY_DISCOUNT: DiscountFormValues = {
  code: '',
  description: '',
  type: 'PERCENTAGE',
  value: '',
  minOrderValue: '',
  maxDiscount: '',
  appliesTo: 'ALL',
  customerScope: 'ALL',
  maxUses: '',
  maxUsesPerUser: '',
  validFrom: '',
  validUntil: '',
  status: 'ACTIVE',
};

function toIsoDateOrNull(d: string): string | null {
  if (!d) return null;
  // <input type="date"> gives yyyy-mm-dd in user's locale. Treat as local midnight.
  return new Date(`${d}T00:00:00`).toISOString();
}

function toServerPayload(v: DiscountFormValues, isUpdate: boolean) {
  const payload: Record<string, unknown> = {
    code: v.code.trim().toUpperCase(),
    description: v.description.trim() || null,
    type: v.type,
    value: v.type === 'FREE_SHIPPING' ? '0' : v.value,
    minOrderValue: v.minOrderValue ? v.minOrderValue : null,
    maxDiscount: v.type === 'PERCENTAGE' && v.maxDiscount ? v.maxDiscount : null,
    appliesTo: v.appliesTo,
    customerScope: v.customerScope,
    maxUses: v.maxUses ? Number(v.maxUses) : null,
    maxUsesPerUser: v.maxUsesPerUser ? Number(v.maxUsesPerUser) : null,
    validFrom: toIsoDateOrNull(v.validFrom),
    validUntil: toIsoDateOrNull(v.validUntil),
    status: v.status,
  };
  if (!isUpdate) {
    // create endpoint: required fields are non-null
    return payload;
  }
  return payload;
}

interface Props {
  initial: DiscountFormValues;
  mode: 'create' | 'edit';
}

export function DiscountForm({ initial, mode }: Props) {
  const router = useRouter();
  const [v, setV] = useState<DiscountFormValues>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function update<K extends keyof DiscountFormValues>(key: K, val: DiscountFormValues[K]) {
    setV((cur) => ({ ...cur, [key]: val }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Light client-side validation; server is the source of truth.
    if (v.code.trim().length < 2) {
      setError('Code must be at least 2 characters');
      return;
    }
    if (v.type !== 'FREE_SHIPPING' && (!v.value || Number(v.value) <= 0)) {
      setError('Enter a value greater than zero');
      return;
    }
    if (v.type === 'PERCENTAGE' && Number(v.value) > 100) {
      setError('Percentage cannot exceed 100');
      return;
    }
    if (v.validFrom && v.validUntil && v.validFrom >= v.validUntil) {
      setError('“Valid until” must be after “Valid from”');
      return;
    }

    startTransition(async () => {
      try {
        if (mode === 'create') {
          const created = await adminApi.post<{ id: string }>(
            '/api/admin/discounts',
            toServerPayload(v, false),
          );
          router.push(`/admin/discounts/${created.id}`);
        } else {
          await adminApi.patch(
            `/api/admin/discounts/${initial.id}`,
            toServerPayload(v, true),
          );
          router.refresh();
        }
      } catch (e) {
        const err = e as { payload?: { message?: string }; message?: string };
        setError(err.payload?.message ?? err.message ?? 'Save failed');
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {/* === Basics =================================================== */}
      <section className="space-y-4 rounded-lg border bg-card p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Basics
        </h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="font-medium">Code</span>
            <Input
              value={v.code}
              onChange={(e) => update('code', e.target.value.toUpperCase())}
              maxLength={40}
              required
              placeholder="WELCOME10"
              className="font-mono uppercase"
            />
            <span className="block text-xs text-muted-foreground">
              Customers type this at checkout. Saved in uppercase.
            </span>
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium">Status</span>
            <select
              value={v.status}
              onChange={(e) => update('status', e.target.value as DiscountStatus)}
              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
            >
              <option value="ACTIVE">Active</option>
              <option value="DISABLED">Disabled</option>
              <option value="EXPIRED">Expired</option>
            </select>
          </label>
        </div>

        <label className="block space-y-1 text-sm">
          <span className="font-medium">Internal description</span>
          <Input
            value={v.description}
            onChange={(e) => update('description', e.target.value)}
            maxLength={500}
            placeholder="e.g. Diwali launch — 10% on all orders above ₹499"
          />
        </label>
      </section>

      {/* === Offer ==================================================== */}
      <section className="space-y-4 rounded-lg border bg-card p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Offer
        </h2>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="space-y-1 text-sm">
            <span className="font-medium">Type</span>
            <select
              value={v.type}
              onChange={(e) => update('type', e.target.value as DiscountType)}
              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
            >
              <option value="PERCENTAGE">Percentage off</option>
              <option value="FIXED_AMOUNT">Fixed amount off</option>
              <option value="FREE_SHIPPING">Free shipping</option>
            </select>
          </label>

          {v.type !== 'FREE_SHIPPING' && (
            <label className="space-y-1 text-sm">
              <span className="font-medium">
                Value {v.type === 'PERCENTAGE' ? '(%)' : '(₹)'}
              </span>
              <Input
                type="number"
                step={v.type === 'PERCENTAGE' ? '1' : '0.01'}
                min="0"
                max={v.type === 'PERCENTAGE' ? '100' : undefined}
                value={v.value}
                onChange={(e) => update('value', e.target.value)}
                required
              />
            </label>
          )}

          {v.type === 'PERCENTAGE' && (
            <label className="space-y-1 text-sm">
              <span className="font-medium">Max discount (₹, optional)</span>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={v.maxDiscount}
                onChange={(e) => update('maxDiscount', e.target.value)}
                placeholder="No cap"
              />
            </label>
          )}
        </div>

        <label className="block space-y-1 text-sm">
          <span className="font-medium">Minimum order value (₹, optional)</span>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={v.minOrderValue}
            onChange={(e) => update('minOrderValue', e.target.value)}
            placeholder="No minimum"
            className="max-w-xs"
          />
        </label>
      </section>

      {/* === Eligibility ============================================== */}
      <section className="space-y-4 rounded-lg border bg-card p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Eligibility
        </h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="font-medium">Applies to</span>
            <select
              value={v.appliesTo}
              onChange={(e) => update('appliesTo', e.target.value as ApplyTarget)}
              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
            >
              <option value="ALL">All products</option>
              <option value="SPECIFIC_PRODUCTS">Specific products (Phase 2)</option>
              <option value="SPECIFIC_CATEGORIES">Specific categories (Phase 2)</option>
            </select>
            <span className="block text-xs text-muted-foreground">
              Product/category targeting UI ships in Phase 2 — for now, scope=ALL only.
            </span>
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium">Customer scope</span>
            <select
              value={v.customerScope}
              onChange={(e) => update('customerScope', e.target.value as CustomerScope)}
              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
            >
              <option value="ALL">All shoppers (guest + logged in)</option>
              <option value="LOGGED_IN">Logged-in customers only</option>
              <option value="NEW_CUSTOMERS">New customers only (first order)</option>
            </select>
          </label>
        </div>
      </section>

      {/* === Usage limits ============================================== */}
      <section className="space-y-4 rounded-lg border bg-card p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Limits
        </h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="font-medium">Total uses (optional)</span>
            <Input
              type="number"
              min="0"
              step="1"
              value={v.maxUses}
              onChange={(e) => update('maxUses', e.target.value)}
              placeholder="Unlimited"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Uses per customer (optional)</span>
            <Input
              type="number"
              min="0"
              step="1"
              value={v.maxUsesPerUser}
              onChange={(e) => update('maxUsesPerUser', e.target.value)}
              placeholder="Unlimited"
            />
            <span className="block text-xs text-muted-foreground">
              Enforced only for logged-in customers — guests bypass per-user limits.
            </span>
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="font-medium">Valid from (optional)</span>
            <Input
              type="date"
              value={v.validFrom}
              onChange={(e) => update('validFrom', e.target.value)}
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Valid until (optional)</span>
            <Input
              type="date"
              value={v.validUntil}
              onChange={(e) => update('validUntil', e.target.value)}
            />
          </label>
        </div>
      </section>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : mode === 'create' ? 'Create discount' : 'Save changes'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/admin/discounts')}
          disabled={pending}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
