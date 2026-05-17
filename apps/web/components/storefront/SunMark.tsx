import { cn } from '@/lib/utils';

interface Props {
  className?: string;
}

/**
 * Vivasvana mark — a stylized rising sun. "Vivasvana" is the Sanskrit name
 * for the sun, source of all nourishment. Two-tone (deep amber sun + warm
 * rays) so the mark reads well on cream backgrounds.
 */
export function SunMark({ className }: Props) {
  return (
    <svg
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={cn('text-brand-500', className)}
    >
      {/* Rays */}
      <g fill="currentColor">
        <rect x="30" y="2" width="4" height="9" rx="2" />
        <rect x="30" y="2" width="4" height="9" rx="2" transform="rotate(45 32 32)" />
        <rect x="30" y="2" width="4" height="9" rx="2" transform="rotate(90 32 32)" />
        <rect x="30" y="2" width="4" height="9" rx="2" transform="rotate(135 32 32)" />
        <rect x="30" y="2" width="4" height="9" rx="2" transform="rotate(180 32 32)" />
        <rect x="30" y="2" width="4" height="9" rx="2" transform="rotate(225 32 32)" />
        <rect x="30" y="2" width="4" height="9" rx="2" transform="rotate(270 32 32)" />
        <rect x="30" y="2" width="4" height="9" rx="2" transform="rotate(315 32 32)" />
      </g>
      {/* Sun disc */}
      <circle cx="32" cy="32" r="14" fill="currentColor" />
      {/* Inner highlight */}
      <circle cx="28" cy="28" r="4" fill="rgba(255,255,255,0.35)" />
    </svg>
  );
}
