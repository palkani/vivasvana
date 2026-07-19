'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { adminApi } from '@/lib/admin-api';

interface Variant {
  id: string;
  productId: string;
  title: string;
  sku: string;
  price: string;
  salePrice: string | null;
  stock: number;
  weight: string | null;
  sortOrder: number;
}

interface DraftFields {
  title: string;
  sku: string;
  price: string;
  salePrice: string;
  stock: string;
  weight: string;
}

const EMPTY_DRAFT: DraftFields = {
  title: '',
  sku: '',
  price: '',
  salePrice: '',
  stock: '0',
  weight: '',
};

function toDraft(v: Variant): DraftFields {
  return {
    title: v.title,
    sku: v.sku,
    price: v.price,
    salePrice: v.salePrice ?? '',
    stock: String(v.stock),
    weight: v.weight ?? '',
  };
}

/** Build the JSON body from draft fields, omitting/ nulling blank optionals. */
function draftToBody(d: DraftFields) {
  return {
    title: d.title.trim(),
    sku: d.sku.trim(),
    price: d.price.trim(),
    salePrice: d.salePrice.trim() === '' ? null : d.salePrice.trim(),
    stock: Number.isFinite(Number(d.stock)) ? Number(d.stock) : 0,
    weight: d.weight.trim() === '' ? null : d.weight.trim(),
  };
}

export function VariantsManager({ productId }: { productId: string }) {
  const [variants, setVariants] = useState<Variant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<DraftFields>(EMPTY_DRAFT);
  const [newDraft, setNewDraft] = useState<DraftFields>(EMPTY_DRAFT);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const rows = await adminApi.get<Variant[]>(`/api/admin/products/${productId}/variants`);
      setVariants(rows);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  async function handleCreate() {
    if (!newDraft.title.trim() || !newDraft.sku.trim() || !newDraft.price.trim()) {
      setError('Title, SKU and price are required.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await adminApi.post(`/api/admin/products/${productId}/variants`, draftToBody(newDraft));
      setNewDraft(EMPTY_DRAFT);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveEdit(id: string) {
    setBusy(true);
    setError(null);
    try {
      await adminApi.patch(
        `/api/admin/products/${productId}/variants/${id}`,
        draftToBody(editDraft),
      );
      setEditingId(null);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this variant? This cannot be undone.')) return;
    setBusy(true);
    setError(null);
    try {
      await adminApi.del(`/api/admin/products/${productId}/variants/${id}`);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Variants</CardTitle>
        <p className="text-xs text-muted-foreground">
          Purchasable sizes (e.g. 500g, 1kg). Each has its own unique SKU, price and stock.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </p>
        )}

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Title</th>
                  <th className="px-3 py-2 font-medium">SKU</th>
                  <th className="px-3 py-2 text-right font-medium">Price</th>
                  <th className="px-3 py-2 text-right font-medium">Sale</th>
                  <th className="px-3 py-2 text-right font-medium">Stock</th>
                  <th className="px-3 py-2 text-right font-medium">Weight (g)</th>
                  <th className="px-3 py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {variants.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                      No variants yet.
                    </td>
                  </tr>
                )}
                {variants.map((v) =>
                  editingId === v.id ? (
                    <tr key={v.id} className="border-b last:border-b-0 align-top">
                      <td className="px-3 py-2">
                        <Input
                          value={editDraft.title}
                          onChange={(e) =>
                            setEditDraft({ ...editDraft, title: e.target.value })
                          }
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          value={editDraft.sku}
                          onChange={(e) => setEditDraft({ ...editDraft, sku: e.target.value })}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          className="text-right"
                          value={editDraft.price}
                          onChange={(e) =>
                            setEditDraft({ ...editDraft, price: e.target.value })
                          }
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          className="text-right"
                          value={editDraft.salePrice}
                          onChange={(e) =>
                            setEditDraft({ ...editDraft, salePrice: e.target.value })
                          }
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          className="text-right"
                          value={editDraft.stock}
                          onChange={(e) =>
                            setEditDraft({ ...editDraft, stock: e.target.value })
                          }
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          className="text-right"
                          value={editDraft.weight}
                          onChange={(e) =>
                            setEditDraft({ ...editDraft, weight: e.target.value })
                          }
                        />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            disabled={busy}
                            onClick={() => handleSaveEdit(v.id)}
                          >
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busy}
                            onClick={() => setEditingId(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr key={v.id} className="border-b last:border-b-0">
                      <td className="px-3 py-2.5 font-medium">{v.title}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{v.sku}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{v.price}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {v.salePrice ?? '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{v.stock}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{v.weight ?? '—'}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => {
                              setEditingId(v.id);
                              setEditDraft(toDraft(v));
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busy}
                            onClick={() => handleDelete(v.id)}
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Add new variant */}
        <div className="rounded-md border border-dashed p-4">
          <p className="mb-3 text-sm font-medium">Add variant</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <LabeledInput
              label="Title"
              placeholder="500g"
              value={newDraft.title}
              onChange={(val) => setNewDraft({ ...newDraft, title: val })}
            />
            <LabeledInput
              label="SKU"
              placeholder="MIL-FOX-500"
              value={newDraft.sku}
              onChange={(val) => setNewDraft({ ...newDraft, sku: val })}
            />
            <LabeledInput
              label="Price"
              placeholder="120.00"
              value={newDraft.price}
              onChange={(val) => setNewDraft({ ...newDraft, price: val })}
            />
            <LabeledInput
              label="Sale price"
              placeholder="optional"
              value={newDraft.salePrice}
              onChange={(val) => setNewDraft({ ...newDraft, salePrice: val })}
            />
            <LabeledInput
              label="Stock"
              placeholder="0"
              value={newDraft.stock}
              onChange={(val) => setNewDraft({ ...newDraft, stock: val })}
            />
            <LabeledInput
              label="Weight (g)"
              placeholder="optional"
              value={newDraft.weight}
              onChange={(val) => setNewDraft({ ...newDraft, weight: val })}
            />
          </div>
          <div className="mt-3">
            <Button type="button" disabled={busy} onClick={handleCreate}>
              {busy ? 'Saving…' : 'Add variant'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function LabeledInput({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (val: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <Input
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}