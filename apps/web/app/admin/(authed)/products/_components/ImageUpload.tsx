'use client';

import * as React from 'react';
import Image from 'next/image';
import { Upload, X, Loader2, ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { uploadProductImage, deleteProductImage, UploadError } from '@/lib/upload';

export interface UploadedImage {
  /** Public URL — what gets persisted in product_images.url */
  url: string;
  /** Storage path — used for delete; null for pre-existing images loaded
   *  from the DB (we don't try to delete those from Storage). */
  path: string | null;
}

interface Props {
  value: UploadedImage[];
  onChange: (next: UploadedImage[]) => void;
  productSlug?: string;
  max?: number;
}

const DEFAULT_MAX = 6;

/**
 * Multi-image upload with drag-drop + click-to-pick. Uploads happen
 * immediately as files are added; the parent only sees URLs once each
 * file is in Storage. Removing an item also deletes the underlying
 * Storage object (for files this component uploaded — pre-existing
 * images from the DB are only detached from the product, not deleted).
 *
 * Reordering is via two ↑/↓ buttons per row. Drag-to-reorder would need
 * @dnd-kit or HTML5 native DnD wiring — skipped here, fine for 6 items.
 */
export function ImageUpload({ value, onChange, productSlug, max = DEFAULT_MAX }: Props) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [pendingCount, setPendingCount] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);

  const atCapacity = value.length >= max;

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setError(null);

    const files = Array.from(fileList).slice(0, max - value.length);
    setPendingCount(files.length);

    const uploaded: UploadedImage[] = [];
    for (const file of files) {
      try {
        const result = await uploadProductImage(file, productSlug);
        uploaded.push({ url: result.url, path: result.path });
      } catch (e) {
        const msg = e instanceof UploadError ? e.message : (e as Error).message;
        setError(`${file.name}: ${msg}`);
      } finally {
        setPendingCount((n) => n - 1);
      }
    }

    if (uploaded.length > 0) {
      onChange([...value, ...uploaded]);
    }
  }

  async function handleRemove(index: number) {
    const item = value[index];
    if (!item) return;
    const next = value.filter((_, i) => i !== index);
    onChange(next);
    // Best-effort delete on Storage. If it fails (e.g. RLS), we just orphan
    // the file — the DB has already let it go.
    if (item.path) {
      try {
        await deleteProductImage(item.path);
      } catch {
        // ignore
      }
    }
  }

  function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    [next[index], next[target]] = [next[target]!, next[index]!];
    onChange(next);
  }

  return (
    <div className="space-y-3">
      <div
        onClick={() => !atCapacity && inputRef.current?.click()}
        onDragOver={(e) => {
          if (atCapacity) return;
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          if (atCapacity) return;
          handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 text-center transition',
          atCapacity
            ? 'cursor-not-allowed border-muted bg-muted/30 text-muted-foreground'
            : isDragging
              ? 'border-primary bg-primary/5'
              : 'border-input hover:border-primary/50 hover:bg-accent/30',
        )}
        role="button"
        tabIndex={atCapacity ? -1 : 0}
        aria-disabled={atCapacity}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !atCapacity) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
      >
        <Upload className="h-6 w-6 text-muted-foreground" aria-hidden />
        <p className="text-sm font-medium">
          {atCapacity ? `Max ${max} images` : 'Drag images here or click to browse'}
        </p>
        <p className="text-xs text-muted-foreground">
          JPG, PNG, WebP, AVIF up to 10 MiB · {value.length} / {max} used
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,image/avif"
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files);
            // Reset the input so re-picking the same file fires onChange again
            e.target.value = '';
          }}
        />
      </div>

      {pendingCount > 0 && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          Uploading {pendingCount} {pendingCount === 1 ? 'file' : 'files'}…
        </p>
      )}

      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
          {error}
        </p>
      )}

      {value.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {value.map((img, i) => (
            <li
              key={img.url}
              className="group relative overflow-hidden rounded-md border bg-muted"
            >
              <div className="relative aspect-square">
                <Image
                  src={img.url}
                  alt=""
                  fill
                  sizes="(min-width: 768px) 25vw, 50vw"
                  className="object-cover"
                />
              </div>
              <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-1 bg-gradient-to-b from-black/60 to-transparent p-1.5 opacity-0 transition group-hover:opacity-100">
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="h-6 w-6 p-0"
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    aria-label="Move earlier"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="h-6 w-6 p-0"
                    onClick={() => move(i, 1)}
                    disabled={i === value.length - 1}
                    aria-label="Move later"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                  {i === 0 && (
                    <span className="rounded bg-white px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-foreground">
                      Cover
                    </span>
                  )}
                </div>
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="h-6 w-6 p-0"
                  onClick={() => handleRemove(i)}
                  aria-label="Remove image"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
