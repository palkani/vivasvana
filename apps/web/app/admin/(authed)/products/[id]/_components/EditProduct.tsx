'use client';

import { useEffect, useState } from 'react';
import { adminApi } from '@/lib/admin-api';
import type { ProductDetail } from '@/lib/types';
import { ProductForm } from '../../_components/ProductForm';
import { VariantsManager } from './VariantsManager';

export function EditProduct({ productId }: { productId: string }) {
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await adminApi.get<ProductDetail>(`/api/admin/products/${productId}`);
        if (!cancelled) setProduct(p);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [productId]);

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!product) return <p className="text-sm text-muted-foreground">Loading…</p>;
  return (
    <div className="space-y-8">
      <ProductForm mode="edit" initial={product} />
      <VariantsManager productId={productId} />
    </div>
  );
}
