import { z } from 'zod';
import { prisma } from '@vivasvana/db';
import { AuthService } from '@/lib/server/services/auth.service';
import { OtpService } from '@/lib/server/services/otp.service';
import { route, parseBody, json } from '@/lib/server/http';
import { rateLimit, clientIp } from '@/lib/server/rate-limit';
import { mapAuthError } from '../../_lib/map-error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VerifyBody = z.object({
  email: z.string().trim().email(),
  code: z.string().regex(/^\d{6}$/),
  password: z.string().min(8).max(72),
  name: z.string().trim().min(1).max(80).optional(),
});

// Step 2 of signup — verify OTP, create the user, return session tokens.
export const POST = route(async (req) => {
  // Slow down code-guessing from a single source. The OtpService also caps
  // attempts per code, so this is a second, coarser layer.
  rateLimit(`signup-verify:${clientIp(req)}`, 15, 10 * 60 * 1000);
  const body = await parseBody(req, VerifyBody);
  const service = new AuthService(prisma, new OtpService(prisma));
  try {
    return json(await service.verifySignupOtp(body));
  } catch (err) {
    return mapAuthError(err);
  }
});
