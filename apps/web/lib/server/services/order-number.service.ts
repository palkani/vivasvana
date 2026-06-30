import type { Prisma } from '@vivasvana/db';
import { formatOrderNumber } from '../lib/order-number';

/**
 * Atomic order-number generator backed by a year-scoped Postgres sequence.
 * Sequence name: order_seq_YYYY (created on first use of a year).
 *
 * Lives in its own service because the order create transaction needs to
 * advance the sequence inside the same tx — pass the TransactionClient.
 */
export class OrderNumberService {
  async next(tx: Prisma.TransactionClient): Promise<string> {
    const year = new Date().getUTCFullYear();
    const seqName = `order_seq_${year}`;

    // CREATE SEQUENCE IF NOT EXISTS — idempotent, cheap on subsequent calls.
    // sequences cannot be schema-quoted using prepared statements, so we use
    // $executeRawUnsafe with a strict regex on year to keep injection out.
    if (!/^\d{4}$/.test(String(year))) throw new Error('invalid year');
    await tx.$executeRawUnsafe(
      `CREATE SEQUENCE IF NOT EXISTS ${seqName} START 1 INCREMENT 1`,
    );
    const rows = await tx.$queryRawUnsafe<Array<{ nextval: bigint }>>(
      `SELECT nextval('${seqName}') AS nextval`,
    );
    const next = Number(rows[0]?.nextval ?? 1);
    return formatOrderNumber(year, next);
  }
}
