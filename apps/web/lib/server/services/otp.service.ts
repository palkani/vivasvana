import { createHash, randomInt } from 'node:crypto';
import type { PrismaClient, OtpPurpose } from '@vivasvana/db';

/**
 * Stateless OTP service backed by the OtpCode table.
 *
 * Design choices worth noting:
 *   - Codes are hashed (SHA-256) before storage so a DB leak doesn't yield
 *     a list of valid OTPs.
 *   - One active OTP per (email, purpose). Issuing a new one invalidates
 *     any prior outstanding code — prevents the "use yesterday's code"
 *     class of attack.
 *   - 5 verification attempts per code; on the 6th attempt the code is
 *     invalidated and a new one must be requested. Standard brute-force
 *     defense.
 *   - 10-minute TTL — long enough that a shopper finds the email in a
 *     promotions tab, short enough to limit replay risk.
 *   - 60-second cooldown between issuances per email so the form can't be
 *     used as a free email spammer.
 *
 * The service does NOT send the email itself; it returns the plaintext
 * code so the caller (AuthService) can format and dispatch a branded
 * message. Keeps mailing concerns out of OTP semantics.
 */

const CODE_LENGTH = 6;
const CODE_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

export type OtpVerifyOutcome =
  | { ok: true }
  | { ok: false; reason: 'NOT_FOUND' | 'EXPIRED' | 'WRONG_CODE' | 'TOO_MANY_ATTEMPTS' };

export class OtpService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Issue a fresh OTP for the (email, purpose) pair. Returns the plaintext
   * code so the caller can email it. The DB only ever sees the hash.
   */
  async issueEmail(args: { email: string; purpose: OtpPurpose }): Promise<{
    code: string;
    expiresAt: Date;
  }> {
    const email = args.email.trim().toLowerCase();

    // Cooldown — block rapid re-requests for the same purpose.
    const last = await this.prisma.otpCode.findFirst({
      where: { email, purpose: args.purpose },
      orderBy: { createdAt: 'desc' },
    });
    if (last && Date.now() - last.createdAt.getTime() < RESEND_COOLDOWN_MS) {
      throw new Error('OTP_COOLDOWN');
    }

    // Invalidate any prior outstanding codes for this purpose by marking
    // them used. Cheaper than DELETE for audit and preserves history.
    await this.prisma.otpCode.updateMany({
      where: { email, purpose: args.purpose, usedAt: null },
      data: { usedAt: new Date(0) }, // sentinel: invalidated, not consumed
    });

    const code = generateNumericCode(CODE_LENGTH);
    const expiresAt = new Date(Date.now() + CODE_TTL_MS);
    await this.prisma.otpCode.create({
      data: {
        email,
        codeHash: hash(code),
        purpose: args.purpose,
        expiresAt,
      },
    });

    return { code, expiresAt };
  }

  /**
   * Verify a plaintext code against the latest outstanding OTP for
   * (email, purpose). On success, marks the code consumed so the same
   * code can't be reused. On every failed attempt the counter ticks up;
   * past MAX_ATTEMPTS, the code is dead and the shopper must request
   * a new one.
   */
  async verify(args: {
    email: string;
    code: string;
    purpose: OtpPurpose;
  }): Promise<OtpVerifyOutcome> {
    const email = args.email.trim().toLowerCase();
    const code = args.code.trim();
    if (!/^\d{6}$/.test(code)) return { ok: false, reason: 'WRONG_CODE' };

    const row = await this.prisma.otpCode.findFirst({
      where: { email, purpose: args.purpose, usedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!row) return { ok: false, reason: 'NOT_FOUND' };
    if (row.expiresAt < new Date()) return { ok: false, reason: 'EXPIRED' };

    if (row.attempts >= MAX_ATTEMPTS) {
      // Brute-force door slammed; require a re-request.
      await this.prisma.otpCode.update({
        where: { id: row.id },
        data: { usedAt: new Date(0) },
      });
      return { ok: false, reason: 'TOO_MANY_ATTEMPTS' };
    }

    if (row.codeHash !== hash(code)) {
      await this.prisma.otpCode.update({
        where: { id: row.id },
        data: { attempts: { increment: 1 } },
      });
      return { ok: false, reason: 'WRONG_CODE' };
    }

    // Mark consumed atomically so a concurrent verify can't pass twice.
    const consumed = await this.prisma.otpCode.updateMany({
      where: { id: row.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (consumed.count === 0) return { ok: false, reason: 'WRONG_CODE' };
    return { ok: true };
  }

  // ----- Phone variants (same semantics, keyed on the `phone` column) -----

  /**
   * Issue a fresh OTP for the (phone, purpose) pair. Returns the plaintext
   * code so the caller can SMS it. `phone` must already be normalized to
   * E.164 by the caller. The DB only ever sees the hash.
   */
  async issuePhone(args: { phone: string; purpose: OtpPurpose }): Promise<{
    code: string;
    expiresAt: Date;
  }> {
    const phone = args.phone.trim();

    const last = await this.prisma.otpCode.findFirst({
      where: { phone, purpose: args.purpose },
      orderBy: { createdAt: 'desc' },
    });
    if (last && Date.now() - last.createdAt.getTime() < RESEND_COOLDOWN_MS) {
      throw new Error('OTP_COOLDOWN');
    }

    await this.prisma.otpCode.updateMany({
      where: { phone, purpose: args.purpose, usedAt: null },
      data: { usedAt: new Date(0) },
    });

    const code = generateNumericCode(CODE_LENGTH);
    const expiresAt = new Date(Date.now() + CODE_TTL_MS);
    await this.prisma.otpCode.create({
      data: { phone, codeHash: hash(code), purpose: args.purpose, expiresAt },
    });

    return { code, expiresAt };
  }

  /** Verify a plaintext code against the latest outstanding (phone, purpose) OTP. */
  async verifyPhone(args: {
    phone: string;
    code: string;
    purpose: OtpPurpose;
  }): Promise<OtpVerifyOutcome> {
    const phone = args.phone.trim();
    const code = args.code.trim();
    if (!/^\d{6}$/.test(code)) return { ok: false, reason: 'WRONG_CODE' };

    const row = await this.prisma.otpCode.findFirst({
      where: { phone, purpose: args.purpose, usedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!row) return { ok: false, reason: 'NOT_FOUND' };
    if (row.expiresAt < new Date()) return { ok: false, reason: 'EXPIRED' };

    if (row.attempts >= MAX_ATTEMPTS) {
      await this.prisma.otpCode.update({
        where: { id: row.id },
        data: { usedAt: new Date(0) },
      });
      return { ok: false, reason: 'TOO_MANY_ATTEMPTS' };
    }

    if (row.codeHash !== hash(code)) {
      await this.prisma.otpCode.update({
        where: { id: row.id },
        data: { attempts: { increment: 1 } },
      });
      return { ok: false, reason: 'WRONG_CODE' };
    }

    const consumed = await this.prisma.otpCode.updateMany({
      where: { id: row.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (consumed.count === 0) return { ok: false, reason: 'WRONG_CODE' };
    return { ok: true };
  }
}

function hash(plain: string): string {
  return createHash('sha256').update(plain).digest('hex');
}

function generateNumericCode(length: number): string {
  // randomInt is crypto-grade; avoids the modulo bias of `Math.random() * 10`.
  let out = '';
  for (let i = 0; i < length; i++) out += randomInt(0, 10).toString();
  return out;
}
