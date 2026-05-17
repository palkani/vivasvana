import { Prisma } from '@vivasvana/db';

/**
 * Convert Prisma.Decimal (or anything Decimal-like) to a string so it round-trips
 * through JSON safely. Never use Number() — INR amounts can drift past 1 paise.
 */
export function decimalToString(value: Prisma.Decimal | string | number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return value.toFixed(2);
  return value.toFixed(2);
}

/** Walk an object and coerce any Decimal field to string for JSON responses. */
export function serializeMoney<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(serializeMoney) as unknown as T;
  if (obj instanceof Prisma.Decimal) return (obj.toFixed(2) as unknown) as T;
  if (typeof obj === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      out[k] = serializeMoney(v);
    }
    return out as unknown as T;
  }
  return obj;
}
