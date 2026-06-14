'use client';

import * as React from 'react';
import { Check, Loader2, MapPin } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { searchCities } from '@/lib/city-search';
import type { IndianCity } from '@/lib/india-cities-flat';
import { api } from '@/lib/api';

const RECENT_KEY = 'vv_recent_cities';
const RECENT_MAX = 4;
// If the local in-memory dataset returns this many hits or fewer for a
// query of length >= 2, we also kick off a remote search against India Post.
// 5 is the sweet spot — common queries like "kolk" already saturate locally
// (Kolkata + Kolkapur etc.) so we don't fetch; rare queries like "sirsi"
// return only ~1-2 local hits and a remote pass adds the rest.
const REMOTE_FALLBACK_THRESHOLD = 5;
const REMOTE_DEBOUNCE_MS = 280;

interface RemoteHit {
  city: string;
  state: string;
  stateCode: string;
  pincode: string;
  postOfficeCount: number;
  matchedPlace: string | null;
}

/** Local extension to IndianCity that carries the post-office name we
 *  matched against. Lets the dropdown show "Yelagiri · Vellore, TN". */
type EnrichedCity = IndianCity & { matchedPlace?: string | null };

interface Props {
  /** Current city string (controlled). */
  value: string;
  /** Current ISO state code. Used to mark the in-state suggestion as preferred. */
  stateCode: string;
  /**
   * Fired when the shopper picks a suggestion or commits the typed value.
   * `selection.stateCode` is null for free-text commits (tier-3 towns
   * we don't recognise). The parent should set the city, and if the state
   * code is present, set the state too.
   */
  onSelect: (selection: { city: string; stateCode: string | null }) => void;
  required?: boolean;
  placeholder?: string;
  id?: string;
  /** Optional aria-describedby slot for adjacent help text. */
  describedBy?: string;
}

/**
 * Combobox city input with cross-state fuzzy match.
 *
 * Improvements over CitySelect:
 *   - Searches the ENTIRE India catalog, not just the picked state. Picking
 *     a suggestion sets state + city in one move.
 *   - Custom dropdown instead of <datalist> so we can show "City, State"
 *     and keep visuals consistent across browsers.
 *   - Recent picks persist in localStorage (top of the dropdown when empty).
 *   - Alias-aware: "Bangalore" suggests Bengaluru, "Bombay" suggests Mumbai.
 *   - Free-text commit at the bottom for villages we don't know — pincode
 *     remains the authoritative serviceability check, so we never block.
 *   - Full keyboard navigation (↑/↓/Enter/Esc) for power users on desktop.
 */
export function SmartCityInput({
  value,
  stateCode,
  onSelect,
  required = true,
  placeholder = 'Type your city',
  id,
  describedBy,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [recent, setRecent] = React.useState<IndianCity[]>([]);
  const [remoteHits, setRemoteHits] = React.useState<EnrichedCity[]>([]);
  const [remoteLoading, setRemoteLoading] = React.useState(false);
  const remoteCacheRef = React.useRef<Map<string, EnrichedCity[]>>(new Map());
  const wrapperRef = React.useRef<HTMLDivElement>(null);
  const listboxId = id ? `${id}-listbox` : 'city-listbox';

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(RECENT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as IndianCity[];
        if (Array.isArray(parsed)) setRecent(parsed.slice(0, RECENT_MAX));
      }
    } catch {
      // Quota errors / private mode — silently ignore.
    }
  }, []);

  // Close the popover when the user clicks outside.
  React.useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const localMatches = React.useMemo(() => {
    const trimmed = value.trim();
    if (!trimmed) return [];
    return searchCities(trimmed, { limit: 8 });
  }, [value]);

  // Debounced remote fallback to the India Post post-office directory when
  // the local match set is thin. Two layers of caching keep this fast:
  //   - in-memory Map for the lifetime of this component
  //   - server-side Redis (when available)
  React.useEffect(() => {
    const trimmed = value.trim();
    // Don't bother the network for short queries (api rejects <2 chars and
    // matches would be too noisy anyway).
    if (trimmed.length < 2) {
      setRemoteHits([]);
      setRemoteLoading(false);
      return;
    }
    // If we already have lots of local hits, skip — local is faster and
    // the dataset overlaps a lot for common cities.
    if (localMatches.length > REMOTE_FALLBACK_THRESHOLD) {
      setRemoteHits([]);
      setRemoteLoading(false);
      return;
    }
    const key = trimmed.toLowerCase();
    const cached = remoteCacheRef.current.get(key);
    if (cached) {
      setRemoteHits(cached);
      setRemoteLoading(false);
      return;
    }

    let cancelled = false;
    setRemoteLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await api.get<{ items: RemoteHit[] }>(
          `/api/cities/search?q=${encodeURIComponent(trimmed)}`,
        );
        if (cancelled) return;
        const mapped: EnrichedCity[] = res.items.map((r) => ({
          name: r.city,
          state: r.state,
          stateCode: r.stateCode,
          key: r.city.toLowerCase(),
          matchedPlace: r.matchedPlace,
        }));
        remoteCacheRef.current.set(key, mapped);
        setRemoteHits(mapped);
      } catch {
        if (!cancelled) setRemoteHits([]);
      } finally {
        if (!cancelled) setRemoteLoading(false);
      }
    }, REMOTE_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [value, localMatches.length]);

  const suggestions = React.useMemo<EnrichedCity[]>(() => {
    if (!value.trim()) return [];
    // Merge local + remote, dedupe by (city + stateCode), preserve local
    // order (already scored), then append remote rows the local pass missed.
    const seen = new Set<string>();
    const merged: EnrichedCity[] = [];
    for (const c of localMatches) {
      const k = `${c.key}|${c.stateCode}`;
      if (seen.has(k)) continue;
      seen.add(k);
      merged.push(c);
    }
    for (const c of remoteHits) {
      const k = `${c.key}|${c.stateCode}`;
      if (seen.has(k)) continue;
      seen.add(k);
      merged.push(c);
    }
    if (!stateCode) return merged.slice(0, 12);
    return merged
      .sort((a, b) => {
        const aIn = a.stateCode === stateCode ? 0 : 1;
        const bIn = b.stateCode === stateCode ? 0 : 1;
        return aIn - bIn;
      })
      .slice(0, 12);
  }, [value, stateCode, localMatches, remoteHits]);

  // What rows are visible right now (recent picks when no query, otherwise
  // search matches). The "use as typed" option sits at index `rows.length`
  // when the input has content but isn't an exact match.
  const trimmed = value.trim();
  const rows: EnrichedCity[] = trimmed ? suggestions : recent;
  const exactMatch = trimmed.length > 0 && suggestions.some((s) => s.key === trimmed.toLowerCase());
  const showFreeText = trimmed.length > 0 && !exactMatch;
  const totalRows = rows.length + (showFreeText ? 1 : 0);

  React.useEffect(() => {
    // Whenever the option set changes, snap selection back to the top so
    // pressing Enter immediately picks the best match.
    setActiveIndex(0);
  }, [rows.length, showFreeText]);

  function commitSelection(idx: number) {
    if (idx < rows.length) {
      const city = rows[idx];
      if (!city) return;
      // If the row came from a remote post-office match (matchedPlace set),
      // commit the shopper's actual village/town name rather than the
      // district — feels honest to the typed query and modern couriers
      // route fine on village names as long as state + pincode are right.
      const displayCity = city.matchedPlace ?? city.name;
      saveRecent({ ...city, name: displayCity, key: displayCity.toLowerCase() }, setRecent);
      onSelect({ city: displayCity, stateCode: city.stateCode });
      setOpen(false);
      return;
    }
    // Free-text commit — preserve the user's casing.
    onSelect({ city: trimmed, stateCode: null });
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActiveIndex((i) => Math.min(totalRows - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      if (open && totalRows > 0) {
        e.preventDefault();
        commitSelection(activeIndex);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Input
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={open && totalRows > 0 ? `${listboxId}-${activeIndex}` : undefined}
          aria-describedby={describedBy}
          autoComplete="address-level2"
          required={required}
          placeholder={placeholder}
          value={value}
          onChange={(e) => {
            // Setting the value while the popover is open keeps it open;
            // the focus/blur lifecycle handles the rest.
            onSelect({ city: e.target.value, stateCode: null });
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          className={remoteLoading ? 'pr-9' : undefined}
        />
        {remoteLoading && (
          <Loader2
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground"
            aria-hidden
          />
        )}
      </div>

      {open && totalRows > 0 && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-md border bg-popover py-1 text-sm shadow-lg"
        >
          {/* Recent / matched rows */}
          {rows.map((city, idx) => {
            const isActive = idx === activeIndex;
            const isCurrent = city.name.toLowerCase() === trimmed.toLowerCase();
            return (
              <li
                key={`${city.stateCode}-${city.key}`}
                id={`${listboxId}-${idx}`}
                role="option"
                aria-selected={isActive}
                className={cn(
                  'flex cursor-pointer items-center gap-2 px-3 py-2',
                  isActive && 'bg-brand-50 text-brand-900',
                )}
                onMouseEnter={() => setActiveIndex(idx)}
                onMouseDown={(e) => {
                  // Use onMouseDown so the click commits before the input
                  // loses focus and closes the popover.
                  e.preventDefault();
                  commitSelection(idx);
                }}
              >
                <MapPin
                  className={cn(
                    'h-3.5 w-3.5 shrink-0',
                    isActive ? 'text-brand-600' : 'text-muted-foreground',
                  )}
                  aria-hidden
                />
                <span className="flex min-w-0 flex-1 flex-col leading-tight">
                  {/* When the post-office matched name differs from the
                      district, show it as the primary label and the
                      district as context — feels closer to what the
                      shopper typed. */}
                  {city.matchedPlace ? (
                    <>
                      <span className="truncate text-sm font-medium">
                        {city.matchedPlace}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {city.name} district · {city.state}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="truncate text-sm font-medium">{city.name}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {city.state}
                      </span>
                    </>
                  )}
                </span>
                {isCurrent && <Check className="h-3.5 w-3.5 shrink-0 text-leaf-600" aria-hidden />}
              </li>
            );
          })}

          {!trimmed && recent.length > 0 && (
            <li className="px-3 pb-1 pt-2 text-[10px] uppercase tracking-wider text-muted-foreground">
              Recent
            </li>
          )}

          {/* "Use as typed" — for tier-3 towns we don't recognise. */}
          {showFreeText && (
            <li
              id={`${listboxId}-${rows.length}`}
              role="option"
              aria-selected={activeIndex === rows.length}
              className={cn(
                'flex cursor-pointer items-center gap-2 border-t px-3 py-2 text-muted-foreground',
                activeIndex === rows.length && 'bg-brand-50 text-brand-900',
              )}
              onMouseEnter={() => setActiveIndex(rows.length)}
              onMouseDown={(e) => {
                e.preventDefault();
                commitSelection(rows.length);
              }}
            >
              Use &ldquo;<span className="font-medium text-foreground">{trimmed}</span>&rdquo; — town
              not listed
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

function saveRecent(picked: IndianCity, setRecent: (next: IndianCity[]) => void) {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const prev: IndianCity[] = raw ? (JSON.parse(raw) as IndianCity[]) : [];
    const deduped = [picked, ...prev.filter((c) => c.key !== picked.key)].slice(0, RECENT_MAX);
    localStorage.setItem(RECENT_KEY, JSON.stringify(deduped));
    setRecent(deduped);
  } catch {
    // Quota / private mode — recent picks just won't persist; not fatal.
  }
}
