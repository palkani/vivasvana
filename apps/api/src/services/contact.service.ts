import type { PrismaClient } from '@vivasvana/db';

export interface ContactInput {
  name: string;
  email: string;
  phone?: string;
  subject?: string;
  message: string;
  /** Honeypot — must be empty. Bots auto-fill all visible fields. */
  website?: string;
  /** Client-side timestamp of when the form was loaded; used to detect
   *  too-fast submissions (a real human takes >2s to fill the form). */
  loadedAt?: number;
  /** Authenticated user id (set by route when session present). */
  userId?: string;
}

export interface ContactResult {
  /** Always 200 from the route; this flag lets the route distinguish a
   *  real save from a silent honeypot drop so we can log it for analysis. */
  accepted: boolean;
  reason?: 'honeypot' | 'too_fast' | 'too_many_urls' | 'html_injection' | 'invalid';
  id?: string;
}

/**
 * Patterns that scream "automated submission" or "injection attempt".
 * Each check returns a reason string. The route silently swallows these
 * (200 OK with no DB write) so spammers can't probe what triggered the
 * reject and adjust their payloads.
 */
const HTML_INJECTION_RE =
  /<script\b|<iframe\b|<object\b|<embed\b|javascript:|onerror\s*=|onload\s*=|onclick\s*=|data:text\/html/i;
const URL_RE = /https?:\/\/|www\.[a-z]/gi;
// Control characters are part of the spam fingerprint — bots love to slip in
// NULs and tabs to bypass naive substring checks. The match is intentional.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS_RE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;
const MIN_SUBMIT_MS = 2000; // a real human takes >2s to fill a form
const MAX_URLS = 2;

export class ContactService {
  constructor(private readonly prisma: PrismaClient) {}

  async submit(input: ContactInput): Promise<ContactResult> {
    // 1. Honeypot — must be empty. Bots usually fill every visible-looking field.
    if (input.website && input.website.trim().length > 0) {
      return { accepted: false, reason: 'honeypot' };
    }

    // 2. Time gate — too fast = likely automated
    if (input.loadedAt && Date.now() - input.loadedAt < MIN_SUBMIT_MS) {
      return { accepted: false, reason: 'too_fast' };
    }

    // 3. URL spam — more than 2 links → spam
    const urlMatches = input.message.match(URL_RE);
    if (urlMatches && urlMatches.length > MAX_URLS) {
      return { accepted: false, reason: 'too_many_urls' };
    }

    // 4. HTML/script injection — reject. Prisma + React render-as-text means
    //    these are safe to store, but rejecting them at the door keeps the
    //    admin UI from displaying obvious garbage and signals bad intent.
    if (HTML_INJECTION_RE.test(input.message) || HTML_INJECTION_RE.test(input.name)) {
      return { accepted: false, reason: 'html_injection' };
    }

    // 5. Sanitize: strip ASCII control characters; collapse runs of whitespace.
    const cleanMessage = input.message
      .replace(CONTROL_CHARS_RE, '')
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n') // cap to two consecutive newlines
      .trim();

    const cleanName = input.name.replace(CONTROL_CHARS_RE, '').trim();

    if (cleanMessage.length < 10 || cleanName.length < 1) {
      return { accepted: false, reason: 'invalid' };
    }

    const row = await this.prisma.contactMessage.create({
      data: {
        userId: input.userId ?? null,
        name: cleanName,
        email: input.email.trim().toLowerCase(),
        phone: input.phone?.trim() || null,
        subject: input.subject?.trim() || null,
        message: cleanMessage,
      },
      select: { id: true },
    });

    return { accepted: true, id: row.id };
  }
}
