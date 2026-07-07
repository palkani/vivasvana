import { CheckCircle2, Loader2, AlertCircle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PincodeLookupState } from '@/lib/use-pincode-lookup';

export function PincodeStatus({ state }: { state: PincodeLookupState }) {
  if (state.status === 'idle') return null;

  if (state.status === 'loading') {
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Looking up PIN…
      </p>
    );
  }

  if (state.status === 'success' && state.result) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-leaf-600">
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
        <span>
          <span className="font-medium">{state.result.city}</span>, {state.result.state}
        </span>
      </p>
    );
  }

  if (state.status === 'invalid') {
    return (
      <p className="flex items-center gap-1.5 text-xs text-destructive">
        <AlertCircle className="h-3.5 w-3.5" aria-hidden /> PINs must start 1-9
      </p>
    );
  }

  return (
    <p className={cn('flex items-center gap-1.5 text-xs text-destructive')}>
      <XCircle className="h-3.5 w-3.5" aria-hidden /> Not serviceable
    </p>
  );
}
