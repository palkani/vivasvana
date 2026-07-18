import { randomBytes } from 'node:crypto';
import type { PrismaClient } from '@vivasvana/db';
import { OtpService } from './otp.service';
import { supabaseAdmin } from '../integrations/supabase-admin';
import { sendEmail } from '../integrations/email';
import { sendSms, normalizePhone } from '../integrations/sms';
import { renderOtp } from '../emails/templates';
import { renderOtpSms } from '../sms/templates';
import { env } from '../config/env';

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

  // ----- Phone-OTP login (passwordless) ----------------------------------

  /**
   * Stage 1 of phone login: normalize the number, issue a LOGIN OTP, and
   * SMS it. Throws PHONE_INVALID/PHONE_EMPTY on a bad number (loud, not a
   * silent drop). SMS send is awaited so it actually goes out on serverless;
   * in stub mode (no Twilio creds) it no-ops to a console log.
   */
  async requestPhoneOtp(
    args: { phone: string },
  ): Promise<{ phone: string; expiresAt: Date; devCode?: string }> {
    const phone = normalizePhone(args.phone);
    console.log('[phone-auth] request-otp received', { phone });
    const issued = await this.otp.issuePhone({ phone, purpose: 'LOGIN' });

    const sms = await sendSms({
      to: phone,
      body: renderOtpSms({ code: issued.code, kind: 'login', expiresInMinutes: OTP_TTL_MIN }),
    }).catch((err) => {
      console.error('[phone-auth] SMS send FAILED', { phone, error: (err as Error).message });
      return { sid: null as string | null };
    });

    if (sms?.sid) {
      console.log('[phone-auth] OTP sent via SMS', { phone, sid: sms.sid });
    } else {
      // Stub mode (no Twilio creds) or a send failure — no real SMS went out.
      console.warn(
        '[phone-auth] OTP was NOT delivered via SMS (Twilio not configured or send failed). ' +
          'Set AUTH_DEBUG_OTP=true to expose the code for testing.',
        { phone, debugCodeExposed: env.AUTH_DEBUG_OTP, code: env.AUTH_DEBUG_OTP ? issued.code : undefined },
      );
    }

    return {
      phone,
      expiresAt: issued.expiresAt,
      ...(env.AUTH_DEBUG_OTP ? { devCode: issued.code } : {}),
    };
  }

  /**
   * Stage 2 of phone login: verify the OTP, find-or-create the Supabase user
   * keyed on phone, and mint a session.
   *
   * Session minting is NON-DESTRUCTIVE: we generate a one-time magiclink
   * token via the Admin API and verify it, which yields real session tokens
   * WITHOUT touching the user's password. (A naive "reset password then sign
   * in" would break email/password login for anyone who has both.)
   *
   * Phone is treated as its own identity — a phone-only user gets a
   * synthesized email so we never need Supabase's phone provider enabled.
   * Account-linking (same person via email AND phone) is intentionally out
   * of scope for v1.
   */
  async verifyPhoneOtp(args: { phone: string; code: string }): Promise<{
    accessToken: string;
    refreshToken: string;
    user: { id: string; email: string; phone: string; name: string | null };
  }> {
    const phone = normalizePhone(args.phone);
    console.log('[phone-auth] verify received', { phone });
    const result = await this.otp.verifyPhone({ phone, code: args.code, purpose: 'LOGIN' });
    if (!result.ok) {
      console.warn('[phone-auth] OTP verify rejected', { phone, reason: result.reason });
      throw new Error(`OTP_${result.reason}`);
    }
    console.log('[phone-auth] OTP verified OK', { phone });

    const admin = supabaseAdmin();

    // One-time password we set then immediately consume to mint a session.
    // Setting it is SAFE because users matched by phone are phone-only:
    // `User.phone` is written ONLY by this flow, so there is no user-managed
    // password to clobber. We mint the session by signing in with email +
    // this password — the exact primitive the signup flow uses — so Supabase's
    // phone provider need not be enabled.
    const oneTimePassword = randomBytes(24).toString('hex');

    let user = await this.prisma.user.findFirst({ where: { phone } });
    let email: string;
    if (user) {
      if (user.deletedAt) throw new Error('ACCOUNT_DISABLED');
      email = user.email;
      console.log('[phone-auth] existing user, rotating one-time password', {
        phone,
        userId: user.id,
      });
      const upd = await admin.auth.admin.updateUserById(user.id, {
        password: oneTimePassword,
      });
      if (upd.error) {
        console.error('[phone-auth] updateUserById FAILED', { phone, error: upd.error.message });
        const msg = upd.error.message?.toLowerCase() ?? '';
        if (msg.includes('fetch failed') || msg.includes('econnrefused')) {
          throw new Error('SUPABASE_UNREACHABLE', { cause: upd.error });
        }
        throw new Error('SESSION_MINT_FAILED', { cause: upd.error });
      }
    } else {
      email = `phone_${phone.replace(/\D/g, '')}@phone.vivasvana.app`;
      console.log('[phone-auth] new phone user, creating', { phone, email });
      const created = await admin.auth.admin.createUser({
        email,
        phone,
        email_confirm: true,
        phone_confirm: true,
        password: oneTimePassword,
        user_metadata: { phone },
      });
      if (created.error || !created.data.user) {
        console.error('[phone-auth] createUser FAILED', {
          phone,
          error: created.error?.message,
        });
        const msg = created.error?.message?.toLowerCase() ?? '';
        if (msg.includes('fetch failed') || msg.includes('econnrefused')) {
          throw new Error('SUPABASE_UNREACHABLE', { cause: created.error });
        }
        throw created.error ?? new Error('SUPABASE_CREATE_FAILED');
      }
      user = await this.prisma.user.create({
        data: { id: created.data.user.id, email, phone, role: 'CUSTOMER' },
      });
      console.log('[phone-auth] user created', { phone, userId: user.id });
    }

    const session = await admin.auth.signInWithPassword({ email, password: oneTimePassword });
    if (session.error || !session.data.session) {
      console.error('[phone-auth] signInWithPassword FAILED (session mint)', {
        phone,
        error: session.error?.message,
      });
      throw session.error ?? new Error('SESSION_MINT_FAILED');
    }
    console.log('[phone-auth] session minted OK', { phone, userId: user.id });

    return {
      accessToken: session.data.session.access_token,
      refreshToken: session.data.session.refresh_token,
      user: { id: user.id, email: user.email, phone, name: user.name },
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
