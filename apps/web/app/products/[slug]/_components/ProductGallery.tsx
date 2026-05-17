'use client';

import Image from 'next/image';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { ProductImage } from '@/lib/types';

interface Props {
  images: ProductImage[];
  title: string;
}

export function ProductGallery({ images, title }: Props) {
  const [active, setActive] = useState(0);
  const safeImages = images.length > 0 ? images : [];
  const current = safeImages[active];

  if (!current) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-lg bg-muted text-6xl">
        🌾
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative aspect-square overflow-hidden rounded-lg border bg-muted">
        <Image
          key={current.id}
          src={current.url}
          alt={current.altText ?? title}
          fill
          priority
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="object-cover"
        />
      </div>
      {safeImages.length > 1 && (
        <ul className="grid grid-cols-5 gap-2">
          {safeImages.map((img, i) => (
            <li key={img.id}>
              <button
                type="button"
                onClick={() => setActive(i)}
                aria-label={`View image ${i + 1}`}
                aria-current={i === active}
                className={cn(
                  'relative block aspect-square w-full overflow-hidden rounded-md border bg-muted transition',
                  i === active ? 'border-primary ring-2 ring-primary' : 'hover:border-primary/60',
                )}
              >
                <Image
                  src={img.url}
                  alt={img.altText ?? `${title} ${i + 1}`}
                  fill
                  sizes="120px"
                  className="object-cover"
                />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
