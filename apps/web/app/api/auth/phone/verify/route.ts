import { z } from 'zod';
import { prisma } from '@vivasvana/db';
import { AuthService } from '@/lib/server/services/auth.service';
import { OtpService } from '@/lib/server/services/otp.service';
import { route, parseBody, json } from '@/lib/server/http';
import { rateLimit, clientIp } from '@/lib/server/rate-limit';
import { mapAuthError } from '../../_lib/map-error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({
  phone: z.string().trim().min(7).max(20),
  code: z.string().regex(/^\d{6}$/),
});

// Stage 2 of phone login — verify the code, return session tokens + user.
export const POST = route(async (req) => {
  rateLimit(`phone-verify:${clientIp(req)}`, 10, 10 * 60 * 1000);
  const body = await parseBody(req, Body);
  const service = new AuthService(prisma, new OtpService(prisma));
  try {
    return json(await service.verifyPhoneOtp(body));
  } catch (err) {
    return mapAuthError(err);
  }
});