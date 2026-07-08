import { z } from 'zod';
import { prisma } from '@vivasvana/db';
import { AuthService } from '@/lib/server/services/auth.service';
import { OtpService } from '@/lib/server/services/otp.service';
import { route, parseBody, json } from '@/lib/server/http';
import { rateLimit, clientIp } from '@/lib/server/rate-limit';
import { mapAuthError } from '../../_lib/map-error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

// Step 1 of signup — email the shopper a 6-digit verification code.
export const POST = route(async (req) => {
  // Best-effort throttle: cap OTP requests per IP so the endpoint can't be
  // used to spam emails/SMS (Twilio cost) or brute-force accounts.
  rateLimit(`signup-otp:${clientIp(req)}`, 5, 10 * 60 * 1000);
  const body = await parseBody(req, SignupBody);
  const service = new AuthService(prisma, new OtpService(prisma));
  try {
    const result = await service.requestSignupOtp(body);
    return json({ email: result.email, expiresAt: result.expiresAt.toISOString() }, { status: 201 });
  } catch (err) {
    return mapAuthError(err);
  }
});
