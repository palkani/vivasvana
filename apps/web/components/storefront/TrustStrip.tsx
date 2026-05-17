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
 * Full-bleed green trust strip beneath the header. Always horizontally
 * scrollable — items live on a no-wrap row, the row scrolls horizontally
 * whenever its content exceeds the viewport (mobile, narrow desktops,
 * /admin pages where the sidebar takes 240px of width). On wide screens
 * the row fits naturally; the scroll behavior kicks in only when needed.
 *
 * Scrollbar is hidden via the `.scrollbar-hide` utility (functional, just
 * not visible). Subtle gradient fades on both edges hint that the strip
 * is scrollable.
 */
export function TrustStrip() {
  return (
    <div className="relative w-full bg-leaf-600 text-white">
      <div className="scrollbar-hide overflow-x-auto">
        <ul
          className="flex items-center gap-8 whitespace-nowrap px-4 py-3 text-sm font-medium md:gap-10 md:px-6 md:py-3.5"
          role="list"
        >
          {items.map(({ icon: Icon, label }) => (
            <li key={label} className="flex shrink-0 items-center gap-2">
              <Icon className="h-4 w-4 text-brand-100" aria-hidden />
              <span>{label}</span>
            </li>
          ))}
        </ul>
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
