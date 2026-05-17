import { AlertTriangle } from 'lucide-react';

/**
 * Visible warning that admin auth has been bypassed for development.
 * Renders only on /admin/* when ADMIN_AUTH_DISABLED is set. NEVER shows
 * in production (the env var is force-evaluated false there).
 */
export function DevAuthBanner() {
  return (
    <div
      role="alert"
      className="flex items-center gap-3 border-b border-amber-300 bg-amber-100 px-4 py-2 text-xs font-medium text-amber-900 md:px-8"
    >
      <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
      <span>
        <span className="font-semibold">Dev mode · admin auth disabled.</span>{' '}
        Anyone hitting <code className="font-mono">/admin</code> can change products. Re-enable by
        setting <code className="font-mono">ADMIN_AUTH_DISABLED=false</code> in <code>.env</code>.
        The flag is ignored automatically when{' '}
        <code className="font-mono">NODE_ENV=production</code>.
      </span>
    </div>
  );
}
