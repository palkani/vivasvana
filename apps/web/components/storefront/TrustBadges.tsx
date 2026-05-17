import { ShieldCheck, Leaf, FlaskConical, Truck } from 'lucide-react';

const badges = [
  { icon: ShieldCheck, label: 'FSSAI Certified' },
  { icon: FlaskConical, label: 'Lab Tested' },
  { icon: Leaf, label: '100% Plant-Based' },
  { icon: Truck, label: 'Free Shipping ₹400+' },
];

export function TrustBadges() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {badges.map(({ icon: Icon, label }) => (
        <div
          key={label}
          className="flex flex-col items-center gap-2 rounded-lg border bg-card p-4 text-center"
        >
          <Icon className="h-6 w-6 text-primary" aria-hidden />
          <span className="text-xs font-medium">{label}</span>
        </div>
      ))}
    </div>
  );
}
