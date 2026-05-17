'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { adminApi } from '@/lib/admin-api';
import type { ProductDetail } from '@/lib/types';
import { ImageUpload, type UploadedImage } from './ImageUpload';

interface Props {
  initial?: Partial<ProductDetail> & { id?: string };
  mode: 'create' | 'edit';
}

const EMPTY_INPUT = {
  slug: '',
  title: '',
  description: '',
  shortDescription: '',
  sku: '',
  hsnCode: '1008',
  price: '0.00',
  salePrice: '',
  taxRate: '5.00',
  stock: 0,
  weight: 0,
  status: 'DRAFT' as 'DRAFT' | 'PUBLISHED' | 'ARCHIVED',
  isVegan: true,
  isGlutenFree: false,
  ingredients: '',
  howToUse: '',
  allergens: '',
  metaTitle: '',
  metaDescription: '',
};

type FormState = typeof EMPTY_INPUT;

function buildInitial(p?: Props['initial']): FormState {
  if (!p) return EMPTY_INPUT;
  return {
    slug: p.slug ?? '',
    title: p.title ?? '',
    description: p.description ?? '',
    shortDescription: p.shortDescription ?? '',
    sku: (p as { sku?: string }).sku ?? '',
    hsnCode: p.hsnCode ?? '1008',
    price: p.price ?? '0.00',
    salePrice: p.salePrice ?? '',
    taxRate: p.taxRate ?? '5.00',
    stock: (p as { stock?: number }).stock ?? 0,
    weight: p.weight ? parseFloat(p.weight) : 0,
    status: p.status ?? 'DRAFT',
    isVegan: p.isVegan ?? true,
    isGlutenFree: p.isGlutenFree ?? false,
    ingredients: p.ingredients ?? '',
    howToUse: p.howToUse ?? '',
    allergens: p.allergens ?? '',
    metaTitle: p.metaTitle ?? '',
    metaDescription: p.metaDescription ?? '',
  };
}

export function ProductForm({ initial, mode }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(buildInitial(initial));
  // Images come from two sources: existing rows on the product (path: null —
  // we don't try to delete the underlying Storage object when removed) or
  // freshly uploaded files (path set to the Storage key).
  const [images, setImages] = useState<UploadedImage[]>(
    initial?.images?.map((img) => ({ url: img.url, path: null })) ?? [],
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Drop empty optional fields so the API zod schema doesn't reject them
    const payload: Record<string, unknown> = { ...form };
    if (!form.salePrice) delete payload.salePrice;
    if (!form.shortDescription) delete payload.shortDescription;
    if (!form.weight) delete payload.weight;
    if (!form.metaTitle) delete payload.metaTitle;
    if (!form.metaDescription) delete payload.metaDescription;
    if (!form.allergens) delete payload.allergens;
    payload.images = images.map((img) => img.url);

    startTransition(async () => {
      try {
        if (mode === 'create') {
          await adminApi.post('/api/admin/products', payload);
        } else if (initial?.id) {
          await adminApi.put(`/api/admin/products/${initial.id}`, payload);
        }
        router.push('/admin/products');
        router.refresh();
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Basics</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field label="Title" required>
            <Input value={form.title} onChange={(e) => update('title', e.target.value)} required />
          </Field>
          <Field label="Slug" hint="lowercase, digits, hyphens" required>
            <Input value={form.slug} onChange={(e) => update('slug', e.target.value)} required />
          </Field>
          <Field label="SKU" required>
            <Input value={form.sku} onChange={(e) => update('sku', e.target.value)} required />
          </Field>
          <Field label="HSN code">
            <Input value={form.hsnCode} onChange={(e) => update('hsnCode', e.target.value)} />
          </Field>
          <Field label="Short description" hint="Used on listing cards" className="md:col-span-2">
            <Input
              value={form.shortDescription}
              onChange={(e) => update('shortDescription', e.target.value)}
              maxLength={280}
            />
          </Field>
          <Field label="Description" required className="md:col-span-2">
            <textarea
              className="min-h-[140px] w-full rounded-md border bg-background p-2 text-sm"
              value={form.description}
              onChange={(e) => update('description', e.target.value)}
              required
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Images</CardTitle>
          <p className="text-sm text-muted-foreground">
            First image is the cover. Drag images in or click to browse.
          </p>
        </CardHeader>
        <CardContent>
          <ImageUpload value={images} onChange={setImages} productSlug={form.slug} max={6} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pricing & inventory</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <Field label="Price (INR)" required>
            <Input value={form.price} onChange={(e) => update('price', e.target.value)} required />
          </Field>
          <Field label="Sale price">
            <Input value={form.salePrice} onChange={(e) => update('salePrice', e.target.value)} />
          </Field>
          <Field label="GST rate %">
            <Input value={form.taxRate} onChange={(e) => update('taxRate', e.target.value)} />
          </Field>
          <Field label="Stock">
            <Input
              type="number"
              value={form.stock}
              onChange={(e) => update('stock', Number(e.target.value))}
              min={0}
            />
          </Field>
          <Field label="Weight (g)">
            <Input
              type="number"
              value={form.weight}
              onChange={(e) => update('weight', Number(e.target.value))}
              min={0}
            />
          </Field>
          <Field label="Status">
            <select
              value={form.status}
              onChange={(e) => update('status', e.target.value as FormState['status'])}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="DRAFT">Draft</option>
              <option value="PUBLISHED">Published</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Content</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Field label="Ingredients">
            <textarea
              className="min-h-[80px] w-full rounded-md border bg-background p-2 text-sm"
              value={form.ingredients}
              onChange={(e) => update('ingredients', e.target.value)}
            />
          </Field>
          <Field label="How to use">
            <textarea
              className="min-h-[80px] w-full rounded-md border bg-background p-2 text-sm"
              value={form.howToUse}
              onChange={(e) => update('howToUse', e.target.value)}
            />
          </Field>
          <Field label="Allergens">
            <Input value={form.allergens} onChange={(e) => update('allergens', e.target.value)} />
          </Field>

          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.isVegan}
                onChange={(e) => update('isVegan', e.target.checked)}
              />
              Vegan
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.isGlutenFree}
                onChange={(e) => update('isGlutenFree', e.target.checked)}
              />
              Gluten-free
            </label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>SEO</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Field label="Meta title">
            <Input value={form.metaTitle} onChange={(e) => update('metaTitle', e.target.value)} />
          </Field>
          <Field label="Meta description">
            <textarea
              className="min-h-[80px] w-full rounded-md border bg-background p-2 text-sm"
              value={form.metaDescription}
              onChange={(e) => update('metaDescription', e.target.value)}
              maxLength={320}
            />
          </Field>
        </CardContent>
      </Card>

      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : mode === 'create' ? 'Create product' : 'Save changes'}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

interface FieldProps {
  label: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}

function Field({ label, hint, required, className, children }: FieldProps) {
  return (
    <label className={`flex flex-col gap-1 ${className ?? ''}`}>
      <span className="text-sm font-medium">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </span>
      {children}
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}
