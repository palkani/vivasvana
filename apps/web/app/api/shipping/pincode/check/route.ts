import { z } from 'zod';
import { prisma } from '@vivasvana/db';
import { ShippingService } from '@/lib/server/services/shipping.service';
import { NotificationService } from '@/lib/server/services/notification.service';
import { route, parseBody, json } from '@/lib/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CheckBody = z.object({
  pincode: z.string().regex(/^\d{6}$/, '6-digit pincode required'),
  weightKg: z.coerce.number().positive().max(50).default(0.5),
});

export const POST = route(async (req) => {
  const body = await parseBody(req, CheckBody);
  const notifications = new NotificationService(prisma);
  const shipping = new ShippingService(prisma, notifications);
  return json(await shipping.checkPincode(body.pincode, body.weightKg));
});
