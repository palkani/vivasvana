'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useTransition } from 'react';

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'price-asc', label: 'Price: low → high' },
  { value: 'price-desc', label: 'Price: high → low' },
  { value: 'bestseller', label: 'Bestseller' },
];

export function ProductsFilterBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === null || value === '') {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    params.delete('page'); // reset pagination on filter change
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  const currentSort = searchParams.get('sort') ?? 'newest';

  return (
    <div
      className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3"
      aria-busy={pending}
    >
      <label className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Sort</span>
        <select
          value={currentSort}
          onChange={(e) => setParam('sort', e.target.value)}
          className="h-9 rounded-md border bg-background px-2 text-sm"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>

      <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
        {pending && <span>Updating…</span>}
      </div>
    </div>
  );
}
