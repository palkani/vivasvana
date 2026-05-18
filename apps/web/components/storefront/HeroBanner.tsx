import Image from 'next/image';
import Link from 'next/link';

interface Props {
  /** Kept for API compatibility with the homepage; unused now that the
   *  hero is a single composed image. */
  productImages?: Array<{ url: string; alt: string; slug: string }>;
}

/**
 * Full-bleed hero mirroring vivasvana.com — the banner image IS the hero,
 * edge-to-edge. Headline, packshots, feature icons and CTAs are all baked
 * into the artwork itself, so no extra HTML copy on top of it.
 *
 * Two invisible click overlays sit over the baked-in "SHOP NOW" /
 * "EXPLORE PRODUCTS" buttons in the artwork so the visual CTAs are
 * actually navigable. The overlays are transparent and only show a
 * focus ring for keyboard users.
 */
export function HeroBanner(_props: Props) {
  return (
    <section
      className="relative w-full overflow-hidden bg-brand-50"
      aria-label="Vivasvana — Fuel your day the natural way"
    >
      {/* The hero text is baked into the image; expose a real h1 to
          screen readers + search engines via sr-only. */}
      <h1 className="sr-only">
        Vivasvana — Fuel your day the natural way with plant-based millet superfoods
      </h1>

      {/* Native banner aspect ratio (1717:916 ≈ 1.875). max-height keeps
          ultra-wide displays from giving us an absurdly tall hero. */}
      <div className="relative w-full" style={{ aspectRatio: '1717 / 916', maxHeight: '85vh' }}>
        <Image
          src="/brand/hero-banner.png"
          alt="Vivasvana — Fuel your day the natural way with Nutri Millet and Millet Mojo plant-based millet superfoods"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />

        {/* Click overlays positioned over the artwork's baked-in CTAs.
            Values are percentages of the 1717×916 source — re-tune if the
            banner art changes. */}
        <Link
          href="/products"
          aria-label="Shop now"
          className="absolute rounded-md outline-none ring-offset-2 transition focus-visible:ring-2 focus-visible:ring-brand-500"
          style={{ left: '36.5%', top: '78%', width: '11%', height: '8.5%' }}
        />
        <Link
          href="/products"
          aria-label="Explore products"
          className="absolute rounded-md outline-none ring-offset-2 transition focus-visible:ring-2 focus-visible:ring-brand-500"
          style={{ left: '50%', top: '78%', width: '14%', height: '8.5%' }}
        />
      </div>
    </section>
  );
}
