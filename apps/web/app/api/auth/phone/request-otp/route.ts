import { z } from 'zod';
import { prisma } from '@vivasvana/db';
import { AuthService } from '@/lib/server/services/auth.service';
import { OtpService } from '@/lib/server/services/otp.service';
import { route, parseBody, json } from '@/lib/server/http';
import { rateLimit, clientIp } from '@/lib/server/rate-limit';
import { mapAuthError } from '../../_lib/map-error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({ phone: z.string().trim().min(7).max(20) });

// Stage 1 of phone login — SMS a 6-digit code to the mobile number.
export const POST = route(async (req) => {
  // Best-effort throttle: cap OTP requests per IP so SMS can't be spammed.
  rateLimit(`phone-otp:${clientIp(req)}`, 5, 10 * 60 * 1000);
  const body = await parseBody(req, Body);
  const service = new AuthService(prisma, new OtpService(prisma));
  try {
    const result = await service.requestPhoneOtp(body);
    return json(
      {
        phone: result.phone,
        expiresAt: result.expiresAt.toISOString(),
        // Present ONLY when AUTH_DEBUG_OTP=true — lets you test without a live
        // SMS provider. Remove that env var before real users arrive.
        ...(result.devCode ? { devCode: result.devCode } : {}),
      },
      { status: 201 },
    );
  } catch (err) {
    return mapAuthError(err);
  }
});