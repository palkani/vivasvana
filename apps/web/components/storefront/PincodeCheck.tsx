'use client';

import { useState, useTransition } from 'react';
import { Truck, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';

interface CheckResult {
  pincode: string;
  serviceable: boolean;
  codAvailable: boolean;
  etaDays: number | null;
  rate: number | null;
  message: string;
}

/**
 * Inline pincode availability check. Drop on PDP, cart, or anywhere the
 * shopper might want to know "do you deliver to my pincode and how fast".
 *
 * Stays small and self-contained — no global state. The result is held
 * in component state and re-checked when the shopper edits the pincode.
 * For a saved-shopper UX, a future revision can read the default address
 * pincode from the session and prefill.
 */
export function PincodeCheck({
  className,
  initialPincode = '',
  weightKg,
}: {
  className?: string;
  initialPincode?: string;
  weightKg?: number;
}) {
  const [pincode, setPincode] = useState(initialPincode);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const valid = /^\d{6}$/.test(pincode);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) {
      setError('Enter a 6-digit pincode.');
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const res = await api.post<CheckResult>('/api/shipping/pincode/check', {
          pincode,
          ...(weightKg ? { weightKg } : {}),
        });
        setResult(res);
      } catch (err) {
        setError((err as Error).message ?? 'Could not check this pincode.');
      }
    });
  }

  return (
    <div className={className}>
      <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[140px]">
          <MapPin
            className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground"
            size={16}
          />
          <Input
            type="text"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            value={pincode}
            onChange={(e) => {
              setPincode(e.target.value.replace(/\D/g, '').slice(0, 6));
              setResult(null);
              setError(null);
            }}
            placeholder="Enter pincode"
            className="pl-8"
            aria-label="Delivery pincode"
          />
        </div>
        <Button type="submit" disabled={!valid || pending} variant="outline">
          {pending ? 'Checking…' : 'Check'}
        </Button>
      </form>

      {error && (
        <p className="mt-2 text-xs text-destructive">{error}</p>
      )}

      {result && !error && (
        <div
          className={`mt-2 flex items-start gap-2 rounded-md border p-2 text-xs ${
            result.serviceable
              ? 'border-leaf-200 bg-leaf-50 text-leaf-900'
              : 'border-amber-200 bg-amber-50 text-amber-900'
          }`}
        >
          <Truck
            size={14}
            className={`mt-[2px] shrink-0 ${result.serviceable ? 'text-leaf-700' : 'text-amber-700'}`}
          />
          <span>{result.message}</span>
        </div>
      )}
    </div>
  );
}
