'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { adminApi } from '@/lib/admin-api';
import { pluralize } from '@/lib/utils';

// --- Types mirroring the inventory API responses -----------------------------

interface LowStockVariant {
  id: string;
  title: string;
  sku: string;
  stock: number;
}
interface LowStockRow {
  id: string;
  title: string;
  sku: string;
  stock: number;
  lowStockAt: number;
  variants: LowStockVariant[];
}
interface LowStockResponse {
  items: LowStockRow[];
}

interface ProductRow {
  id: string;
  title: string;
  sku: string;
}
interface ProductListResponse {
  items: ProductRow[];
}

interface VariantRow {
  id: string;
  title: string;
  sku: string;
  stock: number;
}

interface MovementRow {
  id: string;
  productId: string;
  variantId: string | null;
  delta: number;
  reason: string;
  reference: string | null;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  product: { id: string; title: string; sku: string } | null;
  variant: { id: string; title: string; sku: string } | null;
}
interface MovementsResponse {
  total: number;
  page: number;
  pageSize: number;
  items: MovementRow[];
}

const REASONS = [
  { value: 'ADJUSTMENT', label: 'Manual adjustment' },
  { value: 'PURCHASE_ORDER', label: 'Purchase order (received)' },
  { value: 'RETURN', label: 'Customer return' },
  { value: 'DAMAGED', label: 'Damaged' },
  { value: 'EXPIRED', label: 'Expired' },
  { value: 'SALE', label: 'Sale / manual sell-down' },
] as const;

const REASON_LABEL: Record<string, string> = Object.fromEntries(
  REASONS.map((r) => [r.value, r.label]),
);

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function InventoryView() {
  const [lowStock, setLowStock] = useState<LowStockResponse | null>(null);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [movements, setMovements] = useState<MovementsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Adjust-form state
  const [productId, setProductId] = useState('');
  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [variantId, setVariantId] = useState('');
  const [delta, setDelta] = useState('');
  const [reason, setReason] = useState<string>('ADJUSTMENT');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const loadLowStock = useCallback(async () => {
    const res = await adminApi.get<LowStockResponse>('/api/admin/inventory/low-stock');
    setLowStock(res);
  }, []);

  const loadMovements = useCallback(async () => {
    const res = await adminApi.get<MovementsResponse>(
      '/api/admin/inventory/movements?page=1&pageSize=50',
    );
    setMovements(res);
  }, []);

  const loadProducts = useCallback(async () => {
    // Pull products across every status so out-of-stock/draft items can still be
    // corrected. 60 is the admin list page cap.
    const [pub, draft, arch] = await Promise.all([
      adminApi.get<ProductListResponse>('/api/admin/products?pageSize=60&status=PUBLISHED'),
      adminApi.get<ProductListResponse>('/api/admin/products?pageSize=60&status=DRAFT'),
      adminApi.get<ProductListResponse>('/api/admin/products?pageSize=60&status=ARCHIVED'),
    ]);
    const merged = [...pub.items, ...draft.items, ...arch.items].sort((a, b) =>
      a.title.localeCompare(b.title),
    );
    setProducts(merged);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await Promise.all([loadLowStock(), loadMovements(), loadProducts()]);
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, [loadLowStock, loadMovements, loadProducts]);

  // When a product is chosen, fetch its variants so the admin can target one.
  useEffect(() => {
    if (!productId) {
      setVariants([]);
      setVariantId('');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await adminApi.get<{ variants?: VariantRow[] }>(
          `/api/admin/products/${productId}`,
        );
        if (!cancelled) setVariants(res.variants ?? []);
      } catch {
        if (!cancelled) setVariants([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [productId]);

  function prefill(pId: string, vId: string | null) {
    setProductId(pId);
    setVariantId(vId ?? '');
    setFormError(null);
    setFormSuccess(null);
    if (typeof document !== 'undefined') {
      document.getElementById('adjust-form')?.scrollIntoView({ behavior: 'smooth' });
    }
  }

  async function submitAdjust(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    const deltaNum = Number(delta);
    if (!productId) {
      setFormError('Pick a product first.');
      return;
    }
    if (!Number.isInteger(deltaNum) || deltaNum === 0) {
      setFormError('Delta must be a non-zero whole number (use a leading - to remove stock).');
      return;
    }

    setSubmitting(true);
    try {
      await adminApi.post('/api/admin/inventory/adjust', {
        productId,
        variantId: variantId || undefined,
        delta: deltaNum,
        reason,
        notes: notes.trim() || undefined,
      });
      setFormSuccess(
        `Stock ${deltaNum > 0 ? 'increased' : 'decreased'} by ${Math.abs(deltaNum)}.`,
      );
      setDelta('');
      setNotes('');
      await Promise.all([loadLowStock(), loadMovements()]);
      // Refresh variant stock figures if a variant is targeted.
      if (productId) {
        const res = await adminApi.get<{ variants?: VariantRow[] }>(
          `/api/admin/products/${productId}`,
        );
        setVariants(res.variants ?? []);
      }
    } catch (e) {
      const err = e as { payload?: { message?: string }; message?: string };
      setFormError(err.payload?.message ?? err.message ?? 'Adjustment failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* Low-stock list                                                   */}
      {/* ---------------------------------------------------------------- */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden />
          <h2 className="text-lg font-semibold">Low stock</h2>
        </div>
        <Card>
          <CardContent className="p-0">
            {!lowStock ? (
              <p className="p-8 text-center text-sm text-muted-foreground">Loading…</p>
            ) : lowStock.items.length === 0 ? (
              <p className="p-12 text-center text-sm text-muted-foreground">
                Nothing is at or below its low-stock threshold. 🎉
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium">Product</th>
                      <th className="px-4 py-3 font-medium">SKU</th>
                      <th className="px-4 py-3 font-medium">On hand</th>
                      <th className="px-4 py-3 font-medium">Threshold</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {lowStock.items.map((p) => (
                      <FragmentRow key={p.id} product={p} onAdjust={prefill} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Adjust stock form                                                */}
      {/* ---------------------------------------------------------------- */}
      <section id="adjust-form" className="space-y-3">
        <h2 className="text-lg font-semibold">Adjust stock</h2>
        <Card>
          <CardContent className="p-4">
            <form onSubmit={submitAdjust} className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                <span className="font-medium">Product</span>
                <select
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                  className="h-9 rounded-md border bg-background px-2 text-sm"
                >
                  <option value="">Select a product…</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title} ({p.sku})
                    </option>
                  ))}
                </select>
              </label>

              {variants.length > 0 && (
                <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                  <span className="font-medium">Variant (optional)</span>
                  <select
                    value={variantId}
                    onChange={(e) => setVariantId(e.target.value)}
                    className="h-9 rounded-md border bg-background px-2 text-sm"
                  >
                    <option value="">Whole product (no variant)</option>
                    {variants.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.title} ({v.sku}) — {v.stock} on hand
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">Change (delta)</span>
                <Input
                  type="number"
                  step="1"
                  inputMode="numeric"
                  value={delta}
                  onChange={(e) => setDelta(e.target.value)}
                  placeholder="e.g. 25 to add, -3 to remove"
                />
                <span className="text-xs text-muted-foreground">
                  Positive adds stock, negative removes it.
                </span>
              </label>

              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">Reason</span>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="h-9 rounded-md border bg-background px-2 text-sm"
                >
                  {REASONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                <span className="font-medium">Notes (optional)</span>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Why is this change being made? (audit trail)"
                  rows={2}
                />
              </label>

              {formError && (
                <p className="sm:col-span-2 rounded-md border border-destructive/30 bg-destructive/5 p-2 text-sm text-destructive">
                  {formError}
                </p>
              )}
              {formSuccess && (
                <p className="sm:col-span-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-2 text-sm text-emerald-600">
                  {formSuccess}
                </p>
              )}

              <div className="sm:col-span-2">
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Recording…' : 'Record adjustment'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Recent movements                                                 */}
      {/* ---------------------------------------------------------------- */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Recent stock movements</h2>
        <Card>
          <CardContent className="p-0">
            {!movements ? (
              <p className="p-8 text-center text-sm text-muted-foreground">Loading…</p>
            ) : movements.items.length === 0 ? (
              <p className="p-12 text-center text-sm text-muted-foreground">
                No stock movements recorded yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium">When</th>
                      <th className="px-4 py-3 font-medium">Product</th>
                      <th className="px-4 py-3 font-medium">Change</th>
                      <th className="px-4 py-3 font-medium">Reason</th>
                      <th className="px-4 py-3 font-medium">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.items.map((m) => (
                      <tr key={m.id} className="border-b align-top last:border-b-0">
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                          {formatDateTime(m.createdAt)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium">
                            {m.product?.title ?? 'Unknown product'}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {m.variant ? `${m.variant.title} · ` : ''}
                            {m.variant?.sku ?? m.product?.sku ?? ''}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={
                              m.delta > 0
                                ? 'font-mono font-medium text-emerald-600'
                                : 'font-mono font-medium text-destructive'
                            }
                          >
                            {m.delta > 0 ? `+${m.delta}` : m.delta}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline">
                            {REASON_LABEL[m.reason] ?? m.reason.toLowerCase()}
                          </Badge>
                        </td>
                        <td className="max-w-[240px] px-4 py-3 text-xs text-muted-foreground">
                          {m.notes ?? m.reference ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
        {movements && movements.items.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Showing {movements.items.length} of {movements.total}{' '}
            {pluralize(movements.total, 'movement')}.
          </p>
        )}
      </section>
    </div>
  );
}

// A product row plus its below-threshold variant sub-rows.
function FragmentRow({
  product,
  onAdjust,
}: {
  product: LowStockRow;
  onAdjust: (productId: string, variantId: string | null) => void;
}) {
  const atOrBelow = product.stock <= product.lowStockAt;
  return (
    <>
      <tr className={atOrBelow ? 'border-b bg-amber-500/5 align-top' : 'border-b align-top'}>
        <td className="px-4 py-3 font-medium">{product.title}</td>
        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{product.sku}</td>
        <td className="px-4 py-3">
          <span className={product.stock <= product.lowStockAt ? 'font-semibold text-destructive' : ''}>
            {product.stock}
          </span>
        </td>
        <td className="px-4 py-3 text-muted-foreground">{product.lowStockAt}</td>
        <td className="px-4 py-3 text-right">
          <Button variant="outline" size="sm" onClick={() => onAdjust(product.id, null)}>
            Adjust
          </Button>
        </td>
      </tr>
      {product.variants.map((v) => (
        <tr key={v.id} className="border-b bg-muted/20 align-top text-xs">
          <td className="px-4 py-2 pl-8 text-muted-foreground">↳ {v.title}</td>
          <td className="px-4 py-2 font-mono text-muted-foreground">{v.sku}</td>
          <td className="px-4 py-2">
            <span className="font-semibold text-destructive">{v.stock}</span>
          </td>
          <td className="px-4 py-2 text-muted-foreground">{product.lowStockAt}</td>
          <td className="px-4 py-2 text-right">
            <Button variant="ghost" size="sm" onClick={() => onAdjust(product.id, v.id)}>
              Adjust
            </Button>
          </td>
        </tr>
      ))}
    </>
  );
}