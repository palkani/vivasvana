/**
 * Free India Post PIN + post-office lookup. No auth needed. Cached
 * aggressively because the dataset rarely changes.
 *
 * Spec: https://api.postalpincode.in/pincode/{pin}
 *       https://api.postalpincode.in/postoffice/{name}
 *
 * The postoffice/{name} endpoint backs typeahead city search — it covers
 * every PIN-served place in India (~150k post offices) so we don't have to
 * bundle a giant cities dataset client-side.
 */

import type { Redis } from 'ioredis';

export interface PinLookupResult {
  pincode: string;
  city: string;
  state: string;        // human-readable, e.g. "Tamil Nadu"
  stateCode: string;    // ISO 3166-2:IN code we map ourselves
  serviceable: boolean;
}

interface PostOfficeRecord {
  Name: string;
  District: string;
  State: string;
}

interface PostApiResponse {
  Message: string;
  Status: 'Success' | 'Error';
  PostOffice: PostOfficeRecord[] | null;
}

// Map a subset of state names → ISO codes. Add more as we ship to new states.
const STATE_CODES: Record<string, string> = {
  'Andhra Pradesh': 'AP',
  'Arunachal Pradesh': 'AR',
  Assam: 'AS',
  Bihar: 'BR',
  Chhattisgarh: 'CT',
  Delhi: 'DL',
  Goa: 'GA',
  Gujarat: 'GJ',
  Haryana: 'HR',
  'Himachal Pradesh': 'HP',
  'Jammu and Kashmir': 'JK',
  Jharkhand: 'JH',
  Karnataka: 'KA',
  Kerala: 'KL',
  'Madhya Pradesh': 'MP',
  Maharashtra: 'MH',
  Manipur: 'MN',
  Meghalaya: 'ML',
  Mizoram: 'MZ',
  Nagaland: 'NL',
  Odisha: 'OR',
  Puducherry: 'PY',
  Punjab: 'PB',
  Rajasthan: 'RJ',
  Sikkim: 'SK',
  'Tamil Nadu': 'TN',
  Telangana: 'TG',
  Tripura: 'TR',
  'Uttar Pradesh': 'UP',
  Uttarakhand: 'UT',
  'West Bengal': 'WB',
};

const CACHE_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export async function lookupPincode(pin: string, redis?: Redis): Promise<PinLookupResult | null> {
  if (!/^[1-9]\d{5}$/.test(pin)) return null;

  const cacheKey = `pin:${pin}`;
  if (redis) {
    // Cache lookup is best-effort: a Redis outage must not break PIN
    // resolution. `.catch(() => null)` keeps us flowing through to the
    // network fetch instead of throwing a 500 at the route layer.
    const cached = await redis.get(cacheKey).catch(() => null);
    if (cached) {
      try {
        return JSON.parse(cached) as PinLookupResult;
      } catch {
        // fall through to refetch
      }
    }
  }

  let result: PinLookupResult | null;
  try {
    const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
    if (!res.ok) return null;
    const data = (await res.json()) as PostApiResponse[];
    const first = data[0];
    if (!first || first.Status !== 'Success' || !first.PostOffice?.length) return null;
    const office = first.PostOffice[0];
    if (!office) return null;
    result = {
      pincode: pin,
      city: office.District,
      state: office.State,
      stateCode: STATE_CODES[office.State] ?? '',
      serviceable: true,
    };
  } catch {
    return null;
  }

  if (redis && result) {
    // Cache writes are best-effort for the same reason as reads.
    await redis.setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(result)).catch(() => null);
  }
  return result;
}

// ---------------------------------------------------------------------------
// City typeahead — search the post-office directory by name
// ---------------------------------------------------------------------------

export interface CitySearchHit {
  /** Display name — the district. This is the canonical "city" we store
   *  on the order, because couriers route on the district name. */
  city: string;
  state: string;     // human-readable
  stateCode: string; // ISO 3166-2:IN
  /** Sample pincode for the city — useful as a fallback if the shopper
   *  later types a city without a pincode and we want to pre-fill one. */
  pincode: string;
  /** Number of post offices under this district that matched. Higher = more
   *  populous place; used as a relevance tiebreaker. */
  postOfficeCount: number;
  /** A matched post-office name (the village/town the shopper actually
   *  typed). Lets the UI show "Yelagiri · Vellore, TN" so the shopper sees
   *  *why* this district was suggested. Null when the district name itself
   *  was the strongest match. */
  matchedPlace: string | null;
}

const SEARCH_CACHE_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
const MAX_SEARCH_HITS = 15;

/**
 * Search India Post's post-office directory by partial name. India Post
 * supports prefix-style matches against the post-office Name field; we
 * aggregate the response by District+State so the consumer sees one entry
 * per real-world city rather than dozens of branch post offices.
 *
 * Returns empty array for queries shorter than 2 characters (the upstream
 * API rejects short queries with 500s).
 */
export async function searchCitiesByName(
  query: string,
  redis?: Redis,
): Promise<CitySearchHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const cacheKey = `citysearch:${q.toLowerCase()}`;
  if (redis) {
    const cached = await redis.get(cacheKey).catch(() => null);
    if (cached) {
      try {
        return JSON.parse(cached) as CitySearchHit[];
      } catch {
        // fall through to refetch
      }
    }
  }

  let hits: CitySearchHit[];
  try {
    const res = await fetch(
      `https://api.postalpincode.in/postoffice/${encodeURIComponent(q)}`,
      {
        // Upstream sometimes hangs — keep the bound tight so a typeahead
        // request doesn't hold the connection open forever.
        signal: AbortSignal.timeout(4000),
      },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as PostApiResponse[];
    const first = data[0];
    if (!first || first.Status !== 'Success' || !first.PostOffice?.length) return [];

    // Group by District+State so a query like "kolkata" returns one
    // "Kolkata, West Bengal" row instead of 200 branch offices.
    const byCity = new Map<string, CitySearchHit>();
    const qLower = q.toLowerCase();
    for (const po of first.PostOffice) {
      if (!po.District || !po.State) continue;
      const key = `${po.District}|${po.State}`;
      const existing = byCity.get(key);
      // The shopper's intended place — if the matched post-office name
      // differs from the district, remember the closest-matching name so
      // the UI can show it as context.
      const nameMatches = po.Name?.toLowerCase().startsWith(qLower);
      if (existing) {
        existing.postOfficeCount += 1;
        if (
          !existing.matchedPlace &&
          nameMatches &&
          po.Name &&
          po.Name.toLowerCase() !== po.District.toLowerCase()
        ) {
          existing.matchedPlace = po.Name;
        }
      } else {
        byCity.set(key, {
          city: po.District,
          state: po.State,
          stateCode: STATE_CODES[po.State] ?? '',
          // Upstream doesn't return the pincode in this endpoint's records
          // for some configurations; the typed any-shape below covers both
          // schemas observed in the wild.
          pincode: (po as { Pincode?: string }).Pincode ?? '',
          postOfficeCount: 1,
          matchedPlace:
            nameMatches &&
            po.Name &&
            po.Name.toLowerCase() !== po.District.toLowerCase()
              ? po.Name
              : null,
        });
      }
    }

    hits = Array.from(byCity.values()).sort((a, b) => {
      // Prefix matches first, then more populous cities (proxy: more POs).
      const qLower = q.toLowerCase();
      const aStarts = a.city.toLowerCase().startsWith(qLower) ? 0 : 1;
      const bStarts = b.city.toLowerCase().startsWith(qLower) ? 0 : 1;
      if (aStarts !== bStarts) return aStarts - bStarts;
      if (b.postOfficeCount !== a.postOfficeCount) {
        return b.postOfficeCount - a.postOfficeCount;
      }
      return a.city.localeCompare(b.city);
    });
    hits = hits.slice(0, MAX_SEARCH_HITS);
  } catch {
    return [];
  }

  if (redis && hits.length > 0) {
    await redis
      .setex(cacheKey, SEARCH_CACHE_TTL_SECONDS, JSON.stringify(hits))
      .catch(() => null);
  }
  return hits;
}
