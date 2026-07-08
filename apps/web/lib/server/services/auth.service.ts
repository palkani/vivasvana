import type { PrismaClient } from '@vivasvana/db';
import { OtpService } from './otp.service';
import { supabaseAdmin } from '../integrations/supabase-admin';
import { sendEmail } from '../integrations/email';
import { sendSms } from '../integrations/sms';
import { renderOtp } from '../emails/templates';
import { renderOtpSms } from '../sms/templates';

/**
 * Customer authentication orchestrator.
 *
 * Why this lives next to Supabase Auth instead of replacing it:
 *   - Supabase still owns sessions / JWT / refresh tokens — battle-tested,
 *     no reason to rebuild.
 *   - We layer our OWN email-OTP step in front of Supabase signup so we
 *     control the email branding (Resend), the OTP UX, and the rate
 *     limits. Once OTP is verified we use Supabase Admin to create the
 *     user with `email_confirm: true`, then mint a session and return it.
 *
 * Two paths today:
 *   - SIGNUP:    requestSignupOtp → verifySignupOtp → user + session
 *   - ORDER:     requestOrderOtp  → (front-end submits OTP with order)
 *
 * Order verification happens inside the order create transaction
 * (OrderService consumes the OTP) so a successful checkout is atomic.
 */

const OTP_TTL_MIN = 10;

export class AuthService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly otp: OtpService,
  ) {}

  // ----- Signup -----------------------------------------------------------

  /**
   * Stage 1 of signup: shopper enters email/password/name; we issue an OTP
   * and email it. The password and name are NOT stored anywhere yet —
   * they're returned to the client which holds them in component state
   * and re-sends them in stage 2. This keeps an abandoned signup from
   * leaving an unconfirmed account in our DB.
   */
  async requestSignupOtp(args: {
    email: string;
    password: string;
    name?: string;
    phone?: string;
  }) {
    const email = args.email.trim().toLowerCase();
    if (!email || !args.password || args.password.length < 8) {
      throw new Error('INVALID_CREDENTIALS');
    }
    // Block obvious re-registrations early so the error message is friendly
    // instead of leaking through Supabase as a 422 later.
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new Error('EMAIL_ALREADY_REGISTERED');

    const issued = await this.otp.issueEmail({ email, purpose: 'SIGNUP' });
    const mail = renderOtp({
      code: issued.code,
      kind: 'signup',
      expiresInMinutes: OTP_TTL_MIN,
    });
    await sendEmail({ to: email, ...mail });

    // SMS in addition to email when phone is provided. Fire-and-forget —
    // a Twilio outage (or missing creds in dev) must NOT block signup.
    // sendSms already handles invalid numbers + missing creds gracefully.
    if (args.phone) {
      await sendSms({
        to: args.phone,
        body: renderOtpSms({
          code: issued.code,
          kind: 'signup',
          expiresInMinutes: OTP_TTL_MIN,
        }),
      }).catch((err) =>
        console.warn('signup otp sms failed (non-blocking)', {
          email,
          error: (err as Error).message,
        }),
      );
    }
    return { email, expiresAt: issued.expiresAt };
  }

  /**
   * Stage 2 of signup: verify the OTP and create the Supabase auth user.
   * Returns Supabase tokens directly so the browser can drop them into
   * its session.
   */
  async verifySignupOtp(args: {
    email: string;
    code: string;
    password: string;
    name?: string;
  }) {
    const email = args.email.trim().toLowerCase();
    const result = await this.otp.verify({ email, code: args.code, purpose: 'SIGNUP' });
    if (!result.ok) throw new Error(`OTP_${result.reason}`);

    const admin = supabaseAdmin();
    let created;
    try {
      created = await admin.auth.admin.createUser({
        email,
        password: args.password,
        email_confirm: true,
        user_metadata: args.name ? { name: args.name } : undefined,
      });
    } catch (err) {
      // Network failures (Supabase down / unreachable) bubble up as
      // AuthRetryableFetchError. Surface a clear message so the operator
      // knows what's wrong rather than seeing a generic 500.
      const msg = (err as { message?: string })?.message ?? '';
      if (msg.includes('fetch failed') || msg.includes('ECONNREFUSED')) {
        // Preserve the original network error as the `cause` so the
        // server logs still carry the stack trace even though the
        // route layer maps SUPABASE_UNREACHABLE to a friendly 503.
        throw new Error('SUPABASE_UNREACHABLE', { cause: err });
      }
      throw err;
    }
    if (created.error || !created.data.user) {
      // 422 from Supabase if email exists (we already pre-checked but races
      // happen with two browser tabs); surface a clean message either way.
      if (created.error?.message?.toLowerCase().includes('already registered')) {
        throw new Error('EMAIL_ALREADY_REGISTERED');
      }
      throw created.error ?? new Error('SUPABASE_CREATE_FAILED');
    }

    // Mirror into our domain User table immediately so the lazy-upsert
    // in auth.ts isn't the first time the row exists. Carry name through.
    await this.prisma.user.upsert({
      where: { id: created.data.user.id },
      update: { name: args.name ?? undefined },
      create: {
        id: created.data.user.id,
        email,
        name: args.name ?? null,
        role: 'CUSTOMER',
      },
    });

    // Sign the new user in to mint tokens; we already verified email so
    // password sign-in succeeds immediately.
    const session = await admin.auth.signInWithPassword({
      email,
      password: args.password,
    });
    if (session.error || !session.data.session) {
      throw session.error ?? new Error('SUPABASE_SIGNIN_FAILED');
    }

    return {
      accessToken: session.data.session.access_token,
      refreshToken: session.data.session.refresh_token,
      user: {
        id: created.data.user.id,
        email,
        name: args.name ?? null,
      },
    };
  }

  // ----- Order verification ----------------------------------------------

  /**
   * Issue an OTP for an in-flight checkout. Called from the "Place order"
   * button before the form is submitted. The OTP itself is then handed
   * back to /api/orders, which consumes it inside the order-create
   * transaction (so a leaked OTP can't be replayed).
   *
   * For guests, we issue against the email entered on the checkout form
   * — exactly the address the order confirmation will go to. For
   * logged-in users we ignore the form email and use the verified
   * account email (form value is treated as a hint only).
   */
  async requestOrderOtp(args: {
    email: string;
    loggedInEmail?: string;
    phone?: string;
  }) {
    const email = (args.loggedInEmail ?? args.email).trim().toLowerCase();
    if (!email) throw new Error('EMAIL_REQUIRED');

    const issued = await this.otp.issueEmail({ email, purpose: 'COD_VERIFY' });
    const mail = renderOtp({
      code: issued.code,
      kind: 'order',
      expiresInMinutes: OTP_TTL_MIN,
    });
    await sendEmail({ to: email, ...mail });

    // SMS in addition to email when phone is provided. Same fire-and-
    // forget pattern as signup — a checkout in flight is the worst
    // possible time to fail-hard on a Twilio hiccup.
    if (args.phone) {
      await sendSms({
        to: args.phone,
        body: renderOtpSms({
          code: issued.code,
          kind: 'order',
          expiresInMinutes: OTP_TTL_MIN,
        }),
      }).catch((err) =>
        console.warn('order otp sms failed (non-blocking)', {
          email,
          error: (err as Error).message,
        }),
      );
    }
    return { email, expiresAt: issued.expiresAt };
  }
}
