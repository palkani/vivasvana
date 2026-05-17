/**
 * Format: VV{YYYY}-{6-digit-sequence}
 *   VV2026-000001
 *
 * Sequence is sourced from a Postgres sequence per year (created on first call).
 * Lives here as a pure formatter; the API service creates the sequence and
 * advances it inside the order-create transaction (Phase 2).
 */
export function formatOrderNumber(year: number, seq: number): string {
  return `VV${year}-${seq.toString().padStart(6, '0')}`;
}
