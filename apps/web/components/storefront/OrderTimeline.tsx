'use client';

import { useEffect, useState } from 'react';
import { accountApi } from '@/lib/account-api';

interface EventRow {
  id: string;
  status: string;
  rawStatus: string | null;
  location: string | null;
  source: string;
  createdAt: string;
}

/**
 * Tracking timeline for an order. `endpoint` is the timeline API to hit
 * (customer: /api/orders/{id}/timeline, admin: /api/admin/orders/{id}/timeline).
 * accountApi attaches the Supabase session token, which both customer and
 * admin sessions carry. Renders nothing until there is at least one event.
 */
export function OrderTimeline({ endpoint }: { endpoint: string }) {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    accountApi
      .get<{ events: EventRow[] }>(endpoint)
      .then((r) => {
        if (!cancelled) setEvents(r.events ?? []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [endpoint]);

  if (!loaded || events.length === 0) return null;

  return (
    <div className="rounded-lg border bg-card p-5">
      <h3 className="mb-4 font-medium">Tracking timeline</h3>
      <ol className="space-y-4">
        {events.map((e, i) => (
          <li key={e.id} className="flex gap-3 text-sm">
            <div className="flex flex-col items-center">
              <span
                className={
                  'mt-1 h-2.5 w-2.5 shrink-0 rounded-full ' +
                  (i === events.length - 1 ? 'bg-brand-600' : 'bg-muted-foreground/40')
                }
              />
              {i < events.length - 1 && <span className="mt-1 w-px flex-1 bg-border" />}
            </div>
            <div className="pb-1">
              <p className="font-medium">{e.status}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(e.createdAt).toLocaleString('en-IN', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
                {e.location ? ` · ${e.location}` : ''}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
