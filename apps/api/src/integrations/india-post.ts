/**
 * Free India Post PIN lookup. No auth needed. Cached aggressively because the
 * dataset rarely changes.
 *
 * Spec: https://api.postalpincode.in/pincode/{pin}
 */

import type Redis from 'ioredis';

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
    const cached = await redis.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached) as PinLookupResult;
      } catch {
        // fall through to refetch
      }
    }
  }

  let result: PinLookupResult | null = null;
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
    await redis.setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(result));
  }
  return result;
}
