'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { adminApi } from '@/lib/admin-api';
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
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AdminMeContext.Provider value={{ me, loading, error }}>
      {children}
    </AdminMeContext.Provider>
  );
}

export function useAdminMe() {
  return useContext(AdminMeContext);
}
