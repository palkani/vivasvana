'use client';

import * as React from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  MapPin,
  Truck,
  XCircle,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { usePincodeLookup } from '@/lib/use-pincode-lookup';
import type { PinLookupResult } from '@/lib/types';

const CACHE_KEY = 'vv_pincode_cache_v1';
const CACHE_MAX = 50;

// Coarse regional ETA buckets — refined later with actual courier SLA data.
// "Metro" = same-region same-day-to-next-day; "Standard" = 3-5 days for the
// rest. Used to give the shopper a confidence signal at checkout. We'll
// replace this with real courier SLAs once Shiprocket is wired in Phase 3.
const METRO_STATES = new Set(['DL', 'MH', 'KA', 'TN', 'TG', 'HR', 'UP']); // NCR + major DC states

export interface PincodeResolution {
  pincode: string;
  city: string;
  stateCode: string;
  serviceable: boolean;
}

interface Props {
  /** Current pincode (controlled, 6-digit string). */
  value: string;
  /** Fires on every typed character (already numeric-only). */
  onChange: (next: string) => void;
  /**
   * Fires once per successful resolution. The parent decides whether to
   * autofill city/state — see `shouldOverwrite` if you want the protection
   * pattern below (don't clobber a city the shopper already typed).
   */
  onResolved?: (r: PincodeResolution) => void;
  /**
   * When true, the resolver will populate the parent regardless of what the
   * parent already has. When false (default), the parent should compare the
   * current city/state to what the API returned and only update if empty or
   * if the shopper hasn't manually changed it since the last resolution.
   */
  forceOverwrite?: boolean;
  required?: boolean;
  id?: string;
  describedBy?: string;
}

/**
 * 6-digit pincode input with autocomplete + serviceability check + ETA.
 *
 * Pipeline:
 *   1. Numeric mask so the input only accepts digits
 *   2. usePincodeLookup hook hits /api/pincode/:pin (debounced 300ms, cached
 *      30 days server-side in Redis)
 *   3. localStorage cache (CACHE_MAX entries) shows the previous result
 *      instantly for the same pincode — even when offline
 *   4. On success, fire onResolved + render a banner showing City, State,
 *      and ETA bucket so the shopper has confidence before they hit Place
 *      order
 *
 * Failure modes are first-class:
 *   - too-short  → silent (we don't nag while they're still typing)
 *   - invalid    → "PINs must start 1-9"
 *   - not-found  → "Not serviceable" + offer to "let us know" via contact form
 */
export function SmartPincodeInput({
  value,
  onChange,
  onResolved,
  forceOverwrite = false,
  required = true,
  id,
  describedBy,
}: Props) {
  // Last successful lookup we've already fired; prevents duplicate parent
  // updates if the hook re-emits the same result on remount.
  const lastNotifiedRef = React.useRef<string>('');

  const lookup = usePincodeLookup(value, (r) => {
    if (lastNotifiedRef.current === r.pincode) return;
    lastNotifiedRef.current = r.pincode;
    writeCache(r);
    if (onResolved) {
      onResolved({
        pincode: r.pincode,
        city: r.city,
        stateCode: r.stateCode,
        serviceable: r.serviceable,
      });
    }
  });

  // Instant cache hit for known pincodes — populates while the network
  // request is still in flight.
  const cached = useCachedPin(value);

  // Fire cached resolution synchronously so the parent autofills on first
  // render of a previously-seen pincode (e.g. user navigates back).
  React.useEffect(() => {
    if (!cached) return;
    if (lookup.status === 'success') return; // network result will win
    if (lastNotifiedRef.current === cached.pincode) return;
    lastNotifiedRef.current = cached.pincode;
    if (onResolved) {
      onResolved({
        pincode: cached.pincode,
        city: cached.city,
        stateCode: cached.stateCode,
        serviceable: cached.serviceable,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cached?.pincode]);

  // Decide what to show under the field. Prefer the live network result,
  // then the cache, then the typing status.
  const effective: PinLookupResult | null =
    lookup.status === 'success' ? lookup.result : cached;

  return (
    <div className="space-y-1.5">
      <Input
        id={id}
        required={required}
        inputMode="numeric"
        pattern="[1-9][0-9]{5}"
        maxLength={6}
        autoComplete="postal-code"
        placeholder="6-digit PIN"
        aria-describedby={describedBy}
        value={value}
        onChange={(e) => {
          // Strip non-digits. Pasting "560 001" still works.
          onChange(e.target.value.replace(/\D/g, '').slice(0, 6));
          // Reset the dedupe so a fresh 6-digit value can resolve again.
          if (e.target.value.length < 6) lastNotifiedRef.current = '';
        }}
        // Hint forceOverwrite to suppress lint about unused prop while it's
        // reserved for future "Replace" button UX.
        data-force-overwrite={forceOverwrite || undefined}
      />
      <StatusLine lookup={lookup} effective={effective} />
    </div>
  );
}

function StatusLine({
  lookup,
  effective,
}: {
  lookup: ReturnType<typeof usePincodeLookup>;
  effective: PinLookupResult | null;
}) {
  if (lookup.status === 'loading') {
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Looking up PIN…
      </p>
    );
  }

  if (lookup.status === 'invalid') {
    return (
      <p className="flex items-center gap-1.5 text-xs text-destructive">
        <AlertCircle className="h-3.5 w-3.5" aria-hidden /> PINs must start 1-9
      </p>
    );
  }

  if (effective) {
    const eta = etaLabel(effective.stateCode);
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-leaf-200/60 bg-leaf-50/40 px-2.5 py-1.5 text-xs">
        <span className="flex items-center gap-1.5 text-leaf-700">
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
          <span className="font-medium">{effective.city}</span>
          <span className="text-leaf-700/80">· {effective.state}</span>
        </span>
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Truck className="h-3.5 w-3.5" aria-hidden /> {eta}
        </span>
        {!effective.serviceable && (
          <span className="flex items-center gap-1.5 text-destructive">
            <XCircle className="h-3.5 w-3.5" aria-hidden /> Limited service
          </span>
        )}
      </div>
    );
  }

  if (lookup.status === 'not_serviceable') {
    return (
      <p className="flex items-center gap-1.5 text-xs text-destructive">
        <XCircle className="h-3.5 w-3.5" aria-hidden />
        PIN not serviceable yet — message us via Contact and we&rsquo;ll add it
      </p>
    );
  }

  return (
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <MapPin className="h-3.5 w-3.5" aria-hidden />
      Enter PIN to auto-fill city & state
    </p>
  );
}

function etaLabel(stateCode: string): string {
  return METRO_STATES.has(stateCode) ? 'Delivery 2-4 business days' : 'Delivery 4-7 business days';
}

// ----- localStorage cache --------------------------------------------------

interface CacheEntry extends PinLookupResult {
  ts: number;
}

function readCache(): Record<string, CacheEntry> {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, CacheEntry>;
  } catch {
    return {};
  }
}

function writeCache(r: PinLookupResult) {
  try {
    const all = readCache();
    all[r.pincode] = { ...r, ts: Date.now() };
    // Cap size — drop oldest entries.
    const entries = Object.entries(all);
    if (entries.length > CACHE_MAX) {
      entries.sort((a, b) => b[1].ts - a[1].ts);
      const trimmed = Object.fromEntries(entries.slice(0, CACHE_MAX));
      localStorage.setItem(CACHE_KEY, JSON.stringify(trimmed));
    } else {
      localStorage.setItem(CACHE_KEY, JSON.stringify(all));
    }
  } catch {
    // Quota — silently skip.
  }
}

function useCachedPin(pincode: string): PinLookupResult | null {
  return React.useMemo(() => {
    const pin = pincode.trim();
    if (!/^[1-9]\d{5}$/.test(pin)) return null;
    if (typeof window === 'undefined') return null;
    const hit = readCache()[pin];
    if (!hit) return null;
    // 30-day TTL mirrors the server-side Redis cache.
    if (Date.now() - hit.ts > 30 * 24 * 60 * 60 * 1000) return null;
    const { ts: _ts, ...rest } = hit;
    return rest;
  }, [pincode]);
}
