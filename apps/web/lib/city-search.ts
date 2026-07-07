import { ALL_INDIAN_CITIES, CITY_ALIASES, type IndianCity } from './india-cities-flat';

/**
 * Tier-1 / metro cities that get a small score bonus when relevance is tied.
 * 70% of orders come from these for most Indian DTC brands, so surfacing
 * them at the top of an ambiguous query (e.g. "ba" → Bengaluru first) is
 * the right default. Re-rank by actual order data once we have it.
 */
const TIER_1 = new Set([
  'mumbai',
  'delhi',
  'bengaluru',
  'hyderabad',
  'chennai',
  'kolkata',
  'pune',
  'ahmedabad',
  'jaipur',
  'surat',
  'lucknow',
  'kanpur',
  'nagpur',
  'indore',
  'thane',
  'bhopal',
  'visakhapatnam',
  'patna',
  'vadodara',
  'ghaziabad',
  'ludhiana',
  'agra',
  'nashik',
  'faridabad',
  'meerut',
  'rajkot',
  'kalyan',
  'vasai',
  'varanasi',
  'srinagar',
  'aurangabad',
  'dhanbad',
  'amritsar',
  'navi mumbai',
  'allahabad',
  'prayagraj',
  'ranchi',
  'howrah',
  'coimbatore',
  'jabalpur',
  'gwalior',
  'vijayawada',
  'jodhpur',
  'madurai',
  'raipur',
  'kota',
  'guwahati',
  'chandigarh',
  'thiruvananthapuram',
  'gurgaon',
  'gurugram',
  'noida',
]);

export interface CitySearchOptions {
  /** Hard cap on results returned to the UI. */
  limit?: number;
  /** When set, restrict search to this state code (still useful for review). */
  stateCode?: string;
  /** Include alias matches in the result set. */
  includeAliases?: boolean;
}

interface ScoredCity {
  city: IndianCity;
  score: number;
  matchedAlias: string | null;
}

/**
 * Smart fuzzy search across the entire flat city index.
 *
 * Scoring (higher = better):
 *   1000 — alias hit (e.g. "bombay" exactly matches the alias "bombay")
 *    900 — exact name match
 *    700 — starts-with the query
 *    500 — word-boundary starts-with (e.g. "navi" hits "Navi Mumbai")
 *    300 — contains the query
 *
 * Tier-1 cities get a +20 boost so they win ties.
 *
 * Empty query returns an empty array — the caller decides whether to show
 * a "recent picks" list in that case.
 */
export function searchCities(query: string, opts: CitySearchOptions = {}): IndianCity[] {
  const { limit = 8, stateCode, includeAliases = true } = opts;
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const scored: ScoredCity[] = [];

  for (const city of ALL_INDIAN_CITIES) {
    if (stateCode && city.stateCode !== stateCode) continue;
    const score = scoreCity(city, q);
    if (score > 0) {
      scored.push({ city, score, matchedAlias: null });
    }
  }

  if (includeAliases) {
    for (const [alias, official] of Object.entries(CITY_ALIASES)) {
      if (!alias.startsWith(q) && !alias.includes(q)) continue;
      const officialKey = official.toLowerCase();
      const target = ALL_INDIAN_CITIES.find((c) => c.key === officialKey);
      if (!target) continue;
      if (stateCode && target.stateCode !== stateCode) continue;
      // Don't double-list if we already scored the official name above.
      if (scored.some((s) => s.city.key === target.key)) continue;
      scored.push({
        city: target,
        score: alias === q ? 1000 : 700,
        matchedAlias: alias,
      });
    }
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    // Tie-breakers: tier-1 first, then alphabetical.
    const aTier = TIER_1.has(a.city.key) ? 0 : 1;
    const bTier = TIER_1.has(b.city.key) ? 0 : 1;
    if (aTier !== bTier) return aTier - bTier;
    return a.city.key.localeCompare(b.city.key);
  });

  return scored.slice(0, limit).map((s) => s.city);
}

function scoreCity(city: IndianCity, q: string): number {
  const k = city.key;
  let score = 0;
  if (k === q) score = 900;
  else if (k.startsWith(q)) score = 700;
  else if (containsAtWordStart(k, q)) score = 500;
  else if (k.includes(q)) score = 300;
  else return 0;

  if (TIER_1.has(k)) score += 20;
  return score;
}

function containsAtWordStart(name: string, q: string): boolean {
  // Word-boundary check — "navi" should hit "navi mumbai" even though it's
  // not at index 0. Splits on space/hyphen.
  if (name.startsWith(q)) return true;
  let i = 0;
  while (i < name.length) {
    if (name[i] === ' ' || name[i] === '-') {
      if (name.startsWith(q, i + 1)) return true;
    }
    i++;
  }
  return false;
}
