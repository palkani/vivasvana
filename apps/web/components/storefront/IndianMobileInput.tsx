import * as React from 'react';
import { cn } from '@/lib/utils';

interface Props {
  id?: string;
  value: string;
  onChange: (next: string) => void;
  required?: boolean;
  autoComplete?: string;
  className?: string;
}

const HELP = 'Enter a 10-digit Indian mobile number starting with 6, 7, 8, or 9.';

/**
 * Phone input dedicated to Indian mobile numbers.
 * - +91 prefix is always visible so users know which country we expect
 * - Strips non-digits on type (handles paste from "+91 98765 43210" → 9876543210)
 * - Native HTML5 validation pattern matches the API regex ^[6-9]\d{9}$
 * - `title` attribute becomes the browser's tooltip + the validation error
 *   message (replaces the unhelpful "Please match the requested format.")
 * - A helper line below the input states the rule before the user hits submit
 */
export function IndianMobileInput({
  id,
  value,
  onChange,
  required = true,
  autoComplete = 'tel-national',
  className,
}: Props) {
  const handle = (raw: string) => {
    // Strip everything that isn't a digit; drop a leading "91" the user may
    // have pasted with the prefix.
    let digits = raw.replace(/\D/g, '');
    if (digits.length > 10 && digits.startsWith('91')) digits = digits.slice(2);
    if (digits.length > 10 && digits.startsWith('091')) digits = digits.slice(3);
    onChange(digits.slice(0, 10));
  };

  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex items-stretch rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background">
        <span
          className="flex select-none items-center border-r border-input bg-muted px-3 text-sm text-muted-foreground"
          aria-hidden
        >
          +91
        </span>
        <input
          id={id}
          type="tel"
          inputMode="numeric"
          autoComplete={autoComplete}
          required={required}
          pattern="[6-9][0-9]{9}"
          maxLength={10}
          placeholder="98765 43210"
          title={HELP}
          value={value}
          onChange={(e) => handle(e.target.value)}
          className="h-10 flex-1 rounded-r-md bg-transparent px-3 text-sm placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>
      <p className="text-xs text-muted-foreground">{HELP}</p>
    </div>
  );
}
