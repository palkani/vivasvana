import twilio, { type Twilio } from 'twilio';
import { env } from '../config/env';

/**
 * Twilio SMS sender. Mirrors `email.ts`:
 *   - Real Twilio in production
 *   - Console-log dev fallback when credentials are absent
 *
 * Indian carriers (Jio, Airtel, Vi, BSNL) enforce **DLT registration** under
 * TRAI rules: every transactional SMS template + sender ID must be
 * pre-registered on the DLT portal (Vilpower / Smartping etc.). Twilio
 * accepts the DLT IDs at message-send time via `entity_id` and
 * `template_id` parameters — wire those once the brand is registered.
 * Until then, expect Indian-route deliveries to either bounce or be heavily
 * rate-limited. International (E.164 +1, +44, etc.) routes work without
 * DLT.
 *
 * Cost note (June 2026 rates, may shift):
 *   - India transactional: ~$0.04-0.08 / segment (~₹3-7/SMS)
 *   - US:                  ~$0.0083 / segment
 *
 * Segments are calculated by length: GSM-7 ≤ 160 chars, UCS-2 ≤ 70 chars.
 * Order confirmation template is engineered to fit one GSM-7 segment.
 */

export interface SmsMessage {
  to: string;
  body: string;
}

let _client: Twilio | null = null;
function client(): Twilio | null {
  if (_client) return _client;
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN) return null;
  _client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
  return _client;
}

/**
 * Normalize an Indian / international phone number to E.164 (the format
 * Twilio requires). Rules:
 *   - Already starts with `+` → trust the caller, just strip non-digits
 *     after the `+`
 *   - Starts with `91` and is 12 digits → assume India, add `+`
 *   - Exactly 10 digits, starts 6-9 → assume India mobile, prepend `+91`
 *   - Anything else → throw, because Twilio will reject and a bad number
 *     should be a loud bug, not a silent drop
 */
export function normalizePhone(input: string): string {
  const raw = input.trim();
  if (!raw) throw new Error('PHONE_EMPTY');

  if (raw.startsWith('+')) {
    const digits = raw.slice(1).replace(/\D/g, '');
    if (digits.length < 8 || digits.length > 15) throw new Error('PHONE_INVALID');
    return `+${digits}`;
  }

  const digits = raw.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  if (digits.length === 11 && digits.startsWith('0') && /^0[6-9]/.test(digits)) {
    // "09876543210" → strip leading 0, prepend +91
    return `+91${digits.slice(1)}`;
  }
  if (digits.length === 10 && /^[6-9]/.test(digits)) return `+91${digits}`;
  throw new Error('PHONE_INVALID');
}

export async function sendSms(msg: SmsMessage): Promise<{ sid: string | null }> {
  let to: string;
  try {
    to = normalizePhone(msg.to);
  } catch (err) {
    console.warn('[sms] skipping — invalid phone', { raw: msg.to, error: (err as Error).message });
    return { sid: null };
  }

  const c = client();
  if (!c) {
    // Stub mode (no Twilio creds). Log LOUDLY with the FULL body so the OTP
    // is findable in the Vercel function logs while testing without a real
    // SMS provider. console.warn lands in the "Warning" severity bucket.
    console.warn('[SMS STUB] no Twilio creds — message NOT sent. Full body:', { to, body: msg.body });
    return { sid: null };
  }

  if (!env.TWILIO_FROM_NUMBER && !env.TWILIO_MESSAGING_SERVICE_SID) {
    // Misconfiguration — bubble up so it's caught in deployment, not
    // silently swallowed in production.
    throw new Error(
      'twilio: set TWILIO_FROM_NUMBER or TWILIO_MESSAGING_SERVICE_SID to send SMS',
    );
  }

  // Prefer Messaging Service SID when present — it lets Twilio handle the
  // pool of sender numbers, geographic routing, and DLT template lookup
  // for India. Single-number `from:` is fine for dev / non-India routes.
  const result = await c.messages.create({
    to,
    body: msg.body,
    ...(env.TWILIO_MESSAGING_SERVICE_SID
      ? { messagingServiceSid: env.TWILIO_MESSAGING_SERVICE_SID }
      : { from: env.TWILIO_FROM_NUMBER! }),
  });
  return { sid: result.sid };
}
