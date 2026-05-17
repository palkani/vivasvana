/**
 * Idempotent storage setup. Creates the `product-images` bucket on the local
 * Supabase Postgres instance + RLS policies for public read and (dev-only)
 * anon insert/delete.
 *
 * Run once after `supabase start`:
 *   pnpm storage:init
 *
 * In production, set up the bucket via the Supabase dashboard and tighten
 * INSERT to authenticated admin users only.
 */
import { prisma } from '../src/index.js';

const BUCKET = 'product-images';
const MAX_BYTES = 10 * 1024 * 1024; // 10 MiB
const MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

async function main() {
  console.info(`Creating bucket "${BUCKET}"…`);

  // Create the bucket. Supabase Storage backs buckets with rows in storage.buckets.
  await prisma.$executeRawUnsafe(
    `
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ($1, $1, true, $2, $3::text[])
    ON CONFLICT (id) DO UPDATE
      SET public = EXCLUDED.public,
          file_size_limit = EXCLUDED.file_size_limit,
          allowed_mime_types = EXCLUDED.allowed_mime_types;
    `,
    BUCKET,
    MAX_BYTES,
    `{${MIME_TYPES.join(',')}}`,
  );

  console.info('Applying RLS policies…');

  // Drop any existing policies of ours first so this script is rerunnable.
  for (const name of [
    'vivasvana_public_read_product_images',
    'vivasvana_dev_insert_product_images',
    'vivasvana_dev_update_product_images',
    'vivasvana_dev_delete_product_images',
  ]) {
    await prisma.$executeRawUnsafe(
      `DROP POLICY IF EXISTS "${name}" ON storage.objects;`,
    );
  }

  // Public read — anyone can SELECT (the storefront fetches these URLs).
  await prisma.$executeRawUnsafe(`
    CREATE POLICY "vivasvana_public_read_product_images"
      ON storage.objects FOR SELECT
      USING (bucket_id = '${BUCKET}');
  `);

  // Dev-only: anon can INSERT/UPDATE/DELETE. In production replace these
  // with policies that check auth.role() = 'authenticated' AND a custom
  // claim or a role-allowlist via auth.jwt() ->> 'role'.
  await prisma.$executeRawUnsafe(`
    CREATE POLICY "vivasvana_dev_insert_product_images"
      ON storage.objects FOR INSERT
      WITH CHECK (bucket_id = '${BUCKET}');
  `);
  await prisma.$executeRawUnsafe(`
    CREATE POLICY "vivasvana_dev_update_product_images"
      ON storage.objects FOR UPDATE
      USING (bucket_id = '${BUCKET}');
  `);
  await prisma.$executeRawUnsafe(`
    CREATE POLICY "vivasvana_dev_delete_product_images"
      ON storage.objects FOR DELETE
      USING (bucket_id = '${BUCKET}');
  `);

  console.info(`✓ Bucket "${BUCKET}" ready. Uploads accept up to ${MAX_BYTES / 1024 / 1024} MiB`);
  console.info('  Allowed types:', MIME_TYPES.join(', '));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
