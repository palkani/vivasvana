'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import type { DiscountValidationResult, DiscountInfo } from '@/lib/discount';

interface Props {
  subtotal: number;
  applied: DiscountInfo | null;
  onApply: (info: DiscountInfo) => void;
  onClear: () => void;
}

export function DiscountInput({ subtotal, applied, onApply, onClear }: Props) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleApply(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const result = await api.post<DiscountValidationResult>('/api/discount/validate', {
          code: code.trim(),
          subtotal,
        });
        if (!result.valid || !result.discount) {
          setError(result.reason ?? 'Invalid code');
          return;
        }
        onApply(result.discount);
        setCode('');
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  if (applied) {
    return (
      <div className="flex items-center justify-between rounded-md border border-leaf-500/40 bg-leaf-500/5 p-3 text-sm">
        <div>
          <span className="font-medium">{applied.code}</span> applied · −₹{applied.appliedAmount}
          {applied.freeShipping && <span className="ml-1 text-xs">(free shipping)</span>}
        </div>
        <button
          type="button"
          onClick={onClear}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Remove
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleApply} className="space-y-2">
      <div className="flex gap-2">
        <Input
          placeholder="Discount code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          maxLength={40}
          autoCapitalize="characters"
        />
        <Button type="submit" variant="outline" disabled={!code || pending}>
          {pending ? '…' : 'Apply'}
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </form>
  );
}
