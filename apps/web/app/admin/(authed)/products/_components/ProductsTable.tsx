'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { adminApi } from '@/lib/admin-api';
import { formatINR } from '@/lib/utils';
import type { ProductCardData, ProductListResponse } from '@/lib/types';

type AdminProduct = ProductCardData;

export function ProductsTable() {
  const [items, setItems] = useState<AdminProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await adminApi.get<ProductListResponse>('/api/admin/products?pageSize=60');
        if (!cancelled) setItems(res.items);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleDelete(id: string) {
    if (!confirm('Archive this product? It will be hidden from the storefront.')) return;
    try {
      await adminApi.del(`/api/admin/products/${id}`);
      setItems((prev) => prev.filter((p) => p.id !== id));
    } catch (e) {
      alert((e as Error).message);
    }
  }

  if (loading) return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
  if (error) return <p className="p-6 text-sm text-destructive">{error}</p>;
  if (items.length === 0) return <p className="p-6 text-sm text-muted-foreground">No products yet.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/50 text-left">
          <tr>
            <th className="px-4 py-3 font-medium">Product</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium text-right">Price</th>
            <th className="px-4 py-3 font-medium text-right">Stock</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {items.map((p) => (
            <tr key={p.id} className="border-b last:border-b-0">
              <td className="px-4 py-3">
                <Link href={`/admin/products/${p.id}`} className="font-medium hover:text-primary">
                  {p.title}
                </Link>
                <div className="text-xs text-muted-foreground">{p.slug}</div>
              </td>
              <td className="px-4 py-3">
                <Badge variant={p.status === 'PUBLISHED' ? 'success' : 'outline'}>
                  {p.status.toLowerCase()}
                </Badge>
              </td>
              <td className="px-4 py-3 text-right tabular-nums">{formatINR(p.salePrice ?? p.price)}</td>
              <td className="px-4 py-3 text-right tabular-nums">{p.stock}</td>
              <td className="px-4 py-3 text-right">
                <div className="inline-flex gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/admin/products/${p.id}`}>Edit</Link>
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(p.id)}>
                    Archive
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
