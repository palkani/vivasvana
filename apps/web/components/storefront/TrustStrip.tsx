import {
  ShieldCheck,
  FlaskConical,
  Sparkles,
  Atom,
  Users,
  Truck,
} from 'lucide-react';

const items = [
  { icon: ShieldCheck, label: 'FSSAI Certified' },
  { icon: FlaskConical, label: 'Lab Tested Quality' },
  { icon: Sparkles, label: 'Authentic Ingredients' },
  { icon: Atom, label: 'Science Backed Formulas' },
  { icon: Users, label: 'Trusted by Thousands' },
  { icon: Truck, label: 'Free Shipping ₹400+' },
];

/**
 * Full-bleed green trust strip beneath the header. Continuous horizontal
 * marquee — items scroll right-to-left forever like the live vivasvana.com
 * site. The seamless loop requires the items array rendered TWICE inside
 * a single track; the .animate-marquee utility translates the track by
 * -50% over its duration so the second copy lands in the first copy's
 * starting position with no visible jump.
 *
 * Pauses on hover. Honors prefers-reduced-motion (animation: none).
 * Marquee duration adjustable per-instance via the --marquee-duration
 * CSS variable (default 30s defined in globals.css).
 */
export function TrustStrip() {
  return (
    <div className="relative w-full overflow-hidden bg-leaf-600 text-white">
      <div
        className="animate-marquee flex w-max items-center whitespace-nowrap py-3 text-sm font-medium md:py-3.5"
        style={{ animationPlayState: 'running' }}
        role="list"
        aria-label="Vivasvana trust signals"
      >
        {/* Two copies of the items for a seamless loop. The second copy
            is aria-hidden so screen readers don't announce duplicates. */}
        {[0, 1].map((copy) => (
          <ul
            key={copy}
            className="flex shrink-0 items-center gap-8 px-4 md:gap-10 md:px-6"
            aria-hidden={copy === 1 ? 'true' : undefined}
          >
            {items.map(({ icon: Icon, label }) => (
              <li key={`${copy}-${label}`} className="flex shrink-0 items-center gap-2">
                <Icon className="h-4 w-4 text-brand-100" aria-hidden />
                <span>{label}</span>
              </li>
            ))}
          </ul>
        ))}
      </div>

      {/* Edge fades — visual cue that more content is hidden off-screen */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-leaf-600 to-transparent"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-leaf-600 to-transparent"
      />
    </div>
  );
}
