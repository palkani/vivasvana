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
 * Full-bleed green band that sits between header and hero. Echoes the live
 * Shopify site's trust strip but built as a real component so it scales
 * across breakpoints (auto-marquees on mobile via overflow + animate).
 */
export function TrustStrip() {
  return (
    <div className="w-full bg-leaf-600 text-white">
      <div className="container relative overflow-hidden">
        <ul
          className="flex items-center gap-8 whitespace-nowrap py-3 text-sm font-medium md:justify-around md:gap-6 md:py-3.5"
          // On mobile, horizontal scroll preserves all items; on md+ they fit.
          style={{ overflowX: 'auto', scrollbarWidth: 'none' }}
        >
          {items.map(({ icon: Icon, label }) => (
            <li key={label} className="flex shrink-0 items-center gap-2">
              <Icon className="h-4 w-4 text-brand-100" aria-hidden />
              <span>{label}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
