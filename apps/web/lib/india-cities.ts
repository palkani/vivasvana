import { CITIES_BY_STATE } from './india-cities-data';

/**
 * Return the city list for an ISO 3166-2:IN state code. Empty if unknown.
 * Defensively deduplicates (case-insensitive) so a stray dataset duplicate
 * never crashes React with a key collision in the consuming combobox.
 */
export function citiesForState(stateCode: string | undefined | null): readonly string[] {
  if (!stateCode) return [];
  const raw = CITIES_BY_STATE[stateCode];
  if (!raw) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const name of raw) {
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

/** Case-insensitive membership check; falls through to true for empty list. */
export function isKnownCity(city: string, stateCode: string | undefined | null): boolean {
  const list = citiesForState(stateCode);
  if (list.length === 0) return true;
  const needle = city.trim().toLowerCase();
  return list.some((c) => c.toLowerCase() === needle);
}

export function totalCityCount(): number {
  return Object.values(CITIES_BY_STATE).reduce((n, arr) => n + arr.length, 0);
}
