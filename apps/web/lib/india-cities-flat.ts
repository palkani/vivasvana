/**
 * Flattened all-India city index for cross-state search.
 *
 * Derived at module-load time from CITIES_BY_STATE + INDIA_STATES. We
 * compute it once and freeze; the array is ~1k entries so search is O(n)
 * and still sub-millisecond on any modern device — no need for a Trie.
 *
 * Each row carries the state metadata so a search match knows where the
 * city lives (and we can autofill the state code when the user picks).
 */

import { CITIES_BY_STATE } from './india-cities-data';
import { INDIA_STATES } from './india-states';

export interface IndianCity {
  name: string;
  state: string;     // human readable
  stateCode: string; // ISO 3166-2:IN
  /** Lowercased search key used by the matcher. */
  key: string;
}

const stateByCode = new Map(INDIA_STATES.map((s) => [s.code, s.name]));

/**
 * Common historical / alternate names → official name. Indian cities went
 * through politically-motivated renames; many shoppers still type the old
 * name. We resolve aliases to the official entry so they get the right
 * match without us having to duplicate rows.
 */
export const CITY_ALIASES: Record<string, string> = {
  bombay: 'Mumbai',
  calcutta: 'Kolkata',
  madras: 'Chennai',
  bangalore: 'Bengaluru',
  poona: 'Pune',
  mysore: 'Mysuru',
  trivandrum: 'Thiruvananthapuram',
  cochin: 'Kochi',
  baroda: 'Vadodara',
  pondicherry: 'Puducherry',
  benares: 'Varanasi',
  banaras: 'Varanasi',
  allahabad: 'Prayagraj',
  gauhati: 'Guwahati',
  cawnpore: 'Kanpur',
  cuddapah: 'Kadapa',
  bezwada: 'Vijayawada',
  bellary: 'Ballari',
  gulbarga: 'Kalaburagi',
  bijapur: 'Vijayapura',
  hubli: 'Hubballi',
  belgaum: 'Belagavi',
  tumkur: 'Tumakuru',
  shimoga: 'Shivamogga',
};

function buildFlatIndex(): readonly IndianCity[] {
  const rows: IndianCity[] = [];
  for (const [stateCode, cities] of Object.entries(CITIES_BY_STATE)) {
    const stateName = stateByCode.get(stateCode) ?? stateCode;
    for (const city of cities) {
      rows.push({
        name: city,
        state: stateName,
        stateCode,
        key: city.toLowerCase(),
      });
    }
  }
  // Sort by name once so search results are inherently alphabetical when
  // multiple cities tie on score.
  rows.sort((a, b) => a.key.localeCompare(b.key));
  return Object.freeze(rows);
}

export const ALL_INDIAN_CITIES: readonly IndianCity[] = buildFlatIndex();

/** Quick lookup map: lowercased city → IndianCity. Singular value (first match wins). */
const CITY_BY_KEY = new Map<string, IndianCity>();
for (const row of ALL_INDIAN_CITIES) {
  if (!CITY_BY_KEY.has(row.key)) CITY_BY_KEY.set(row.key, row);
}

/**
 * Resolve a user-typed string to a known city, considering aliases.
 * Returns null if unrecognised — caller decides whether to allow free text.
 */
export function resolveCity(input: string): IndianCity | null {
  const k = input.trim().toLowerCase();
  if (!k) return null;
  // Alias hop first — "bombay" → look up "mumbai"
  const officialName = CITY_ALIASES[k];
  if (officialName) {
    const aliased = CITY_BY_KEY.get(officialName.toLowerCase());
    if (aliased) return aliased;
  }
  return CITY_BY_KEY.get(k) ?? null;
}
