import { NextResponse } from 'next/server';
import { badRequest, conflict, forbidden } from '@/lib/server/http';

/**
 * Maps AuthService / OtpService domain errors to HTTP responses. Ported
 * verbatim from the Fastify auth route's `mapError`.
 *
 * Most cases reuse the shared `HttpError` helpers (thrown, so `route()` maps
 * them). The 429 (OTP cooldown) and 503 (Supabase unreachable) cases carry
 * the SAME custom body shape the Fastify route sent
 * (`{ statusCode, error, message }`), so they're returned directly rather than
 * thrown through the generic HttpError path.
 *
 * Return type is `NextResponse` for the custom bodies; for the thrown cases
 * control never returns. Anything unrecognised is re-thrown.
 */
export function mapAuthError(err: unknown): NextResponse {
  if (err instanceof Error) {
    if (err.message === 'INVALID_CREDENTIALS') {
      throw badRequest('Email is required and password must be at least 8 characters');
    }
    if (err.message === 'EMAIL_ALREADY_REGISTERED') {
      throw conflict('An account with this email already exists. Try signing in instead.');
    }
    if (err.message === 'EMAIL_REQUIRED') {
      throw badRequest('Email is required');
    }
    if (err.message === 'PHONE_INVALID' || err.message === 'PHONE_EMPTY') {
      throw badRequest('Enter a valid mobile number (e.g. 98765 43210).');
    }
    if (err.message === 'ACCOUNT_DISABLED') {
      throw forbidden('This account has been disabled. Contact support.');
    }
    if (err.message === 'OTP_COOLDOWN') {
      return NextResponse.json(
        {
          statusCode: 429,
          error: 'Too Many Requests',
          message: 'Please wait a minute before requesting another code.',
        },
        { status: 429 },
      );
    }
    if (err.message === 'OTP_NOT_FOUND') {
      throw badRequest('No active code for this email. Please request a new one.');
    }
    if (err.message === 'OTP_EXPIRED') {
      throw badRequest('This code has expired. Please request a new one.');
    }
    if (err.message === 'OTP_WRONG_CODE') {
      throw badRequest('That code is incorrect. Please double-check and try again.');
    }
    if (err.message === 'OTP_TOO_MANY_ATTEMPTS') {
      throw badRequest('Too many failed attempts. Please request a new code.');
    }
    if (err.message === 'SUPABASE_UNREACHABLE') {
      return NextResponse.json(
        {
          statusCode: 503,
          error: 'Service Unavailable',
          message:
            'Authentication service is unreachable. If running locally, start Supabase ' +
            '(`supabase start`) or point SUPABASE_URL at your hosted project.',
        },
        { status: 503 },
      );
    }
  }
  throw err;
}
