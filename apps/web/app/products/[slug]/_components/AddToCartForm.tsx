'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';

interface Props {
  productId: string;
  maxQuantity: number;
}

export function AddToCartForm({ productId, maxQuantity }: Props) {
  const router = useRouter();
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [adding, startAdding] = useTransition();
  const [buyingNow, startBuyingNow] = useTransition();

  const disabled = maxQuantity <= 0;

  function handleAdd(then?: () => void) {
    setError(null);
    startAdding(async () => {
      try {
        await api.post('/api/cart/items', { productId, quantity });
        router.refresh();
        then?.();
      } catch (e) {
        const err = e as { status?: number; message?: string };
        if (err.status === 409) setError('Not enough stock.');
        else setError(err.message ?? 'Could not add to cart.');
      }
    });
  }

  function handleBuyNow() {
    startBuyingNow(() => {
      handleAdd(() => router.push('/cart'));
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <label className="text-sm" htmlFor="qty">Quantity</label>
        <div className="flex items-center rounded-md border">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-none"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            disabled={disabled || quantity <= 1}
            aria-label="Decrease quantity"
          >
            −
          </Button>
          <input
            id="qty"
            type="number"
            min={1}
            max={Math.max(1, maxQuantity)}
            value={quantity}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isFinite(n)) {
                setQuantity(Math.max(1, Math.min(maxQuantity || 1, Math.floor(n))));
              }
            }}
            className="h-10 w-12 border-x bg-transparent text-center text-sm focus:outline-none"
            disabled={disabled}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-none"
            onClick={() => setQuantity((q) => Math.min(maxQuantity || 1, q + 1))}
            disabled={disabled || quantity >= maxQuantity}
            aria-label="Increase quantity"
          >
            +
          </Button>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => handleAdd()}
          disabled={disabled || adding || buyingNow}
        >
          {adding ? 'Adding…' : 'Add to cart'}
        </Button>
        <Button
          type="button"
          size="lg"
          onClick={handleBuyNow}
          disabled={disabled || adding || buyingNow}
        >
          {buyingNow ? 'Loading…' : 'Buy now'}
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
