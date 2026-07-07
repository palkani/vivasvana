'use client';

import { createSupabaseBrowserClient } from './supabase/client';

const BUCKET = 'product-images';
const MAX_BYTES = 10 * 1024 * 1024; // mirror the server-side bucket limit
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

export interface UploadResult {
  url: string;
  path: string;
}

export class UploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UploadError';
  }
}

/**
 * Upload a single product image directly to Supabase Storage from the browser.
 *
 * Path scheme: products/{slug}/{timestamp}-{sanitized-filename}
 * The slug is "draft" if the product hasn't been named yet — these uploads
 * still resolve via their public URL; we could ship a sweeper later to
 * relocate them to their final slug folder. Not worth the complexity now.
 */
export async function uploadProductImage(file: File, slug?: string): Promise<UploadResult> {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new UploadError(
      `Unsupported file type. Use JPG, PNG, WebP, or AVIF (got ${file.type || 'unknown'}).`,
    );
  }
  if (file.size > MAX_BYTES) {
    throw new UploadError(
      `File too large. Max ${(MAX_BYTES / 1024 / 1024).toFixed(0)} MiB, got ${(file.size / 1024 / 1024).toFixed(1)} MiB.`,
    );
  }

  const supabase = createSupabaseBrowserClient();

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const folder = slug ? `products/${slug}` : 'products/draft';
  const path = `${folder}/${Date.now()}-${safeName}`;

  const { data, error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type,
  });
  if (error) throw new UploadError(error.message);

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(data.path);
  return { url: publicUrl, path: data.path };
}

/** Remove an uploaded file (called when user clicks the X on a preview). */
export async function deleteProductImage(path: string): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw new UploadError(error.message);
}
