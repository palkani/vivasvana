import type { FastifyReply } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { AuthService } from '../services/auth.service.js';
import { OtpService } from '../services/otp.service.js';

// Phone is optional on both OTP requests. When present we also dispatch
// the code via SMS (Twilio). Loose validation here — sms/integrations
// normalizes to E.164 and refuses unparseable numbers there.
const PhoneField = z.string().trim().min(7).max(20).optional();

const SignupBody = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8).max(72),
  name: z.string().trim().min(1).max(80).optional(),
  phone: PhoneField,
});

const VerifyBody = z.object({
  email: z.string().trim().email(),
  code: z.string().regex(/^\d{6}$/),
  password: z.string().min(8).max(72),
  name: z.string().trim().min(1).max(80).optional(),
});

const OrderOtpBody = z.object({
  email: z.string().trim().email(),
  phone: PhoneField,
});

function mapError(err: unknown, reply: FastifyReply) {
  if (err instanceof Error) {
    if (err.message === 'INVALID_CREDENTIALS') {
      return reply.badRequest('Email is required and password must be at least 8 characters');
    }
    if (err.message === 'EMAIL_ALREADY_REGISTERED') {
      return reply.conflict('An account with this email already exists. Try signing in instead.');
    }
    if (err.message === 'EMAIL_REQUIRED') {
      return reply.badRequest('Email is required');
    }
    if (err.message === 'OTP_COOLDOWN') {
      return reply
        .status(429)
        .send({
          statusCode: 429,
          error: 'Too Many Requests',
          message: 'Please wait a minute before requesting another code.',
        });
    }
    if (err.message === 'OTP_NOT_FOUND') {
      return reply.badRequest('No active code for this email. Please request a new one.');
    }
    if (err.message === 'OTP_EXPIRED') {
      return reply.badRequest('This code has expired. Please request a new one.');
    }
    if (err.message === 'OTP_WRONG_CODE') {
      return reply.badRequest('That code is incorrect. Please double-check and try again.');
    }
    if (err.message === 'OTP_TOO_MANY_ATTEMPTS') {
      return reply.badRequest('Too many failed attempts. Please request a new code.');
    }
    if (err.message === 'SUPABASE_UNREACHABLE') {
      return reply
        .status(503)
        .send({
          statusCode: 503,
          error: 'Service Unavailable',
          message:
            'Authentication service is unreachable. If running locally, start Supabase ' +
            '(`supabase start`) or point SUPABASE_URL at your hosted project.',
        });
    }
  }
  throw err;
}

const authRoutes: FastifyPluginAsyncZod = async (app) => {
  const otp = new OtpService(app.prisma);
  const service = new AuthService(app.prisma, otp);

  app.post(
    '/api/auth/signup/request-otp',
    {
      schema: {
        tags: ['auth'],
        summary: 'Step 1 of signup — email the shopper a 6-digit verification code',
        body: SignupBody,
      },
    },
    async (req, reply) => {
      try {
        const result = await service.requestSignupOtp(req.body);
        return reply.code(201).send({
          email: result.email,
          expiresAt: result.expiresAt.toISOString(),
        });
      } catch (err) {
        return mapError(err, reply);
      }
    },
  );

  app.post(
    '/api/auth/signup/verify',
    {
      schema: {
        tags: ['auth'],
        summary: 'Step 2 of signup — verify OTP, create the user, return session tokens',
        body: VerifyBody,
      },
    },
    async (req, reply) => {
      try {
        return await service.verifySignupOtp(req.body);
      } catch (err) {
        return mapError(err, reply);
      }
    },
  );

  // Order-time OTP — the front end calls this when the shopper hits
  // "Place order"; the returned email is the address the OTP went to
  // (also the order's confirmation address).
  app.post(
    '/api/auth/order/request-otp',
    {
      preHandler: app.optionalAuth,
      schema: {
        tags: ['auth'],
        summary: 'Email an OTP to confirm the in-flight checkout',
        body: OrderOtpBody,
      },
    },
    async (req, reply) => {
      try {
        const result = await service.requestOrderOtp({
          email: req.body.email,
          phone: req.body.phone,
          loggedInEmail: req.user?.email,
        });
        return reply.code(201).send({
          email: result.email,
          expiresAt: result.expiresAt.toISOString(),
        });
      } catch (err) {
        return mapError(err, reply);
      }
    },
  );
};

export default authRoutes;

