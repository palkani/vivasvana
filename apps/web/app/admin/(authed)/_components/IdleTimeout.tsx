'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';

/**
 * Auto-logout the admin after a period of inactivity — a standard control for
 * admin panels (an unattended session on a shared machine is a real risk).
 *
 * - Any mouse/keyboard/scroll/touch resets the idle clock.
 * - Last-activity is mirrored to localStorage so activity in ANY admin tab
 *   keeps all of them alive (and a sign-out in one tab is felt by the others).
 * - A warning modal counts down for the final `WARN_BEFORE_MS`; "Stay signed
 *   in" resets it, otherwise the Supabase session is signed out and the admin
 *   is bounced to /admin/login?timeout=1.
 */
const IDLE_LIMIT_MS = 30 * 60 * 1000; // sign out after 30 min idle
const WARN_BEFORE_MS = 60 * 1000; // warn for the last 60s
const STORAGE_KEY = 'vv_admin_last_activity';

export function IdleTimeout() {
  const router = useRouter();
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null); // null = no warning
  const signingOut = useRef(false);

  const markActivity = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(Date.now()));
    } catch {
      /* private mode / storage disabled — fall back to per-tab timing */
    }
    setSecondsLeft(null);
  }, []);

  const lastActivity = useCallback((): number => {
    try {
      const v = Number(localStorage.getItem(STORAGE_KEY));
      if (Number.isFinite(v) && v > 0) return v;
    } catch {
      /* ignore */
    }
    return Date.now();
  }, []);

  const signOut = useCallback(async () => {
    if (signingOut.current) return;
    signingOut.current = true;
    try {
      await createSupabaseBrowserClient().auth.signOut();
    } catch {
      /* ignore — redirect regardless */
    }
    router.push('/admin/login?timeout=1');
    router.refresh();
  }, [router]);

  useEffect(() => {
    markActivity(); // seed on mount

    let lastMove = 0;
    const onActivity = () => {
      // Throttle high-frequency events so we're not writing localStorage nonstop.
      const now = Date.now();
      if (now - lastMove < 1000) return;
      lastMove = now;
      markActivity();
    };
    const events: Array<keyof WindowEventMap> = [
      'mousedown',
      'mousemove',
      'keydown',
      'scroll',
      'touchstart',
    ];
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));

    const tick = setInterval(() => {
      const idle = Date.now() - lastActivity();
      if (idle >= IDLE_LIMIT_MS) {
        void signOut();
      } else if (idle >= IDLE_LIMIT_MS - WARN_BEFORE_MS) {
        setSecondsLeft(Math.max(1, Math.ceil((IDLE_LIMIT_MS - idle) / 1000)));
      } else {
        setSecondsLeft(null);
      }
    }, 1000);

    // Another tab recorded activity or signed out → sync our warning state.
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setSecondsLeft(null);
    };
    window.addEventListener('storage', onStorage);

    return () => {
      events.forEach((e) => window.removeEventListener(e, onActivity));
      window.removeEventListener('storage', onStorage);
      clearInterval(tick);
    };
  }, [markActivity, lastActivity, signOut]);

  if (secondsLeft === null) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-lg border bg-card p-6 text-center shadow-lg">
        <h2 className="font-serif text-lg font-semibold">Still there?</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          You&rsquo;ll be signed out in <span className="font-semibold tabular-nums">{secondsLeft}s</span> due
          to inactivity.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <Button onClick={markActivity}>Stay signed in</Button>
          <Button variant="outline" onClick={() => void signOut()}>
            Sign out now
          </Button>
        </div>
      </div>
    </div>
  );
}