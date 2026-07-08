import { z } from 'zod';
import { prisma } from '@vivasvana/db';
import { AuthService } from '@/lib/server/services/auth.service';
import { OtpService } from '@/lib/server/services/otp.service';
import { route, parseBody, json } from '@/lib/server/http';
import { optionalAuth } from '@/lib/server/auth';
import { rateLimit, clientIp } from '@/lib/server/rate-limit';
import { mapAuthError } from '../../_lib/map-error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Phone is optional. When present we also dispatch the code via SMS (Twilio).
const PhoneField = z.string().trim().min(7).max(20).optional();

const OrderOtpBody = z.object({
  email: z.string().trim().email(),
  phone: PhoneField,
});

// Order-time OTP — the front end calls this when the shopper hits "Place
// order"; the returned email is the address the OTP went to (also the order's
// confirmation address). Uses optionalAuth so logged-in shoppers are honoured.
export const POST = route(async (req) => {
  rateLimit(`order-otp:${clientIp(req)}`, 5, 10 * 60 * 1000);
  const user = await optionalAuth(req);
  const body = await parseBody(req, OrderOtpBody);
  const service = new AuthService(prisma, new OtpService(prisma));
  try {
    const result = await service.requestOrderOtp({
      email: body.email,
      phone: body.phone,
      loggedInEmail: user?.email,
    });
    return json({ email: result.email, expiresAt: result.expiresAt.toISOString() }, { status: 201 });
  } catch (err) {
    return mapAuthError(err);
  }
});
