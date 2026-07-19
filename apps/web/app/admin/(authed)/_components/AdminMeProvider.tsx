'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminApi } from '@/lib/admin-api';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { AdminMe } from '@/lib/admin-permissions';

interface AdminMeContextValue {
  me: AdminMe | null;
  loading: boolean;
  error: string | null;
}

const AdminMeContext = createContext<AdminMeContextValue>({
  me: null,
  loading: true,
  error: null,
});

export function AdminMeProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [me, setMe] = useState<AdminMe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await adminApi.get<AdminMe>('/api/admin/me');
        if (!cancelled) setMe(data);
      } catch (e) {
        // A 401 here means the session is gone/expired. Rather than let the
        // admin shell keep firing 401s at every data endpoint, sign out
        // cleanly and bounce to login.
        const status = (e as { status?: number }).status;
        if (status === 401 || status === 403) {
          try {
            await createSupabaseBrowserClient().auth.signOut();
          } catch {
            /* ignore */
          }
          if (!cancelled) router.replace('/admin/login?timeout=1');
          return;
        }
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <AdminMeContext.Provider value={{ me, loading, error }}>
      {children}
    </AdminMeContext.Provider>
  );
}

export function useAdminMe() {
  return useContext(AdminMeContext);
}
