/**
 * Email sender. Uses Resend in production; in development (no RESEND_API_KEY)
 * it logs the payload to console so the dev flow doesn't require an account.
 *
 * Templates live in src/emails/*. Each exports a `render(data)` that returns
 * { subject, html, text }. Plain HTML templates with inline styles — Phase 4
 * can graduate to React Email when content marketing emails join the mix.
 */

import { Resend } from 'resend';
import { env } from '../config/env.js';

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}

let _resend: Resend | null = null;
function client(): Resend | null {
  if (_resend) return _resend;
  if (!env.RESEND_API_KEY) return null;
  _resend = new Resend(env.RESEND_API_KEY);
  return _resend;
}

const FROM = `${process.env.RESEND_FROM_NAME ?? 'Vivasvana'} <${process.env.RESEND_FROM_EMAIL ?? 'orders@vivasvana.com'}>`;

export async function sendEmail(msg: EmailMessage): Promise<{ id: string | null }> {
  const c = client();
  if (!c) {
    // Dev fallback so flow tests work without an API key
    // eslint-disable-next-line no-console
    console.info('[email:dev] would send', {
      to: msg.to,
      subject: msg.subject,
      preview: msg.text.slice(0, 200),
    });
    return { id: null };
  }
  const result = await c.emails.send({
    from: FROM,
    to: msg.to,
    subject: msg.subject,
    html: msg.html,
    text: msg.text,
    replyTo: msg.replyTo,
  });
  return { id: result.data?.id ?? null };
}
