'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from './api';
import type { PinLookupResult } from './types';

export type PincodeLookupStatus = 'idle' | 'loading' | 'success' | 'invalid' | 'not_serviceable';

export interface PincodeLookupState {
  status: PincodeLookupStatus;
  result: PinLookupResult | null;
}

/**
 * Debounced PIN → city/state lookup. Pass the current pincode string; on each
 * change with a valid 6-digit value, the hook hits /api/pincode/:pin (cached
 * server-side in Redis 30d) and exposes { status, result }.
 *
 * `onResolved` fires once per successful lookup with the API payload — wire it
 * to setState in the parent to auto-fill city + state. The parent decides
 * whether to override existing user input; the hook only reports.
 */
export function usePincodeLookup(
  pincode: string,
  onResolved?: (r: PinLookupResult) => void,
  debounceMs = 300,
): PincodeLookupState {
  const [state, setState] = useState<PincodeLookupState>({ status: 'idle', result: null });
  const lastFetched = useRef<string>('');
  const cbRef = useRef(onResolved);
  cbRef.current = onResolved;

  useEffect(() => {
    const pin = pincode.trim();

    if (pin.length === 0) {
      setState({ status: 'idle', result: null });
      return;
    }
    if (!/^[1-9]\d{5}$/.test(pin)) {
      setState({ status: pin.length === 6 ? 'invalid' : 'idle', result: null });
      return;
    }
    if (pin === lastFetched.current && state.status === 'success') {
      // already resolved this exact PIN; skip
      return;
    }

    setState((prev) => ({ status: 'loading', result: prev.result }));
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const result = await api.get<PinLookupResult>(`/api/pincode/${pin}`);
        if (cancelled) return;
        lastFetched.current = pin;
        setState({ status: 'success', result });
        cbRef.current?.(result);
      } catch {
        if (!cancelled) setState({ status: 'not_serviceable', result: null });
      }
    }, debounceMs);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pincode, debounceMs]);

  return state;
}
