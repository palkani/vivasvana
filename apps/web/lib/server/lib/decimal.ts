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
  // Date has no own-enumerable keys, so the previous `typeof === 'object'`
  // branch turned every createdAt/updatedAt into `{}`. Frontend code that
  // did `new Date(item.createdAt)` then got Invalid Date and silently
  // failed (cart timestamps, order receipts, OTP expiry math).
  if (obj instanceof Date) return (obj.toISOString() as unknown) as T;
  if (typeof obj === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      out[k] = serializeMoney(v);
    }
    return out as unknown as T;
  }
  return obj;
}
