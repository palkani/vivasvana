import { z } from 'zod';
import { prisma } from '@vivasvana/db';
import { AddressService } from '@/lib/server/services/address.service';
import { route, parseBody, json } from '@/lib/server/http';
import { requireAuth } from '@/lib/server/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const IN_PINCODE = /^[1-9]\d{5}$/;
// ISO 3166-2:IN codes — see https://en.wikipedia.org/wiki/ISO_3166-2:IN
const IN_STATE = z.string().min(2).max(3);

// Phone validation kept permissive — accepts Indian + international numbers.
// Sanity-check the length only; pretty-printing/format normalization is the
// frontend's job. Tighten this to /^[6-9]\d{9}$/ later if we go India-only.
const PHONE = z.string().min(7).max(20);

export const AddressBody = z.object({
  name: z.string().min(1).max(120),
  phone: PHONE,
  addressLine: z.string().min(5).max(240),
  landmark: z.string().max(120).optional(),
  city: z.string().min(1).max(80),
  state: IN_STATE,
  pincode: z.string().regex(IN_PINCODE, 'invalid Indian PIN'),
  country: z.literal('IN').default('IN'),
  isDefault: z.boolean().optional(),
});

export const GET = route(async (req) => {
  const user = await requireAuth(req);
  const service = new AddressService(prisma);
  return json(await service.listForUser(user.id));
});

export const POST = route(async (req) => {
  const user = await requireAuth(req);
  const body = await parseBody(req, AddressBody);
  const service = new AddressService(prisma);
  const created = await service.create(user.id, body);
  return json(created, { status: 201 });
});
