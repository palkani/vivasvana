import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AddressService } from '../services/address.service.js';

const IN_PINCODE = /^[1-9]\d{5}$/;
// ISO 3166-2:IN codes — see https://en.wikipedia.org/wiki/ISO_3166-2:IN
const IN_STATE = z.string().min(2).max(3);

// Phone validation kept permissive — accepts Indian + international numbers.
// Sanity-check the length only; pretty-printing/format normalization is the
// frontend's job. Tighten this to /^[6-9]\d{9}$/ later if we go India-only.
const PHONE = z.string().min(7).max(20);

const AddressBody = z.object({
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

export default async function addressRoutes(app: FastifyInstance) {
  const service = new AddressService(app.prisma);

  app.register(async (auth) => {
    auth.addHook('preHandler', auth.authenticate);

    auth.get(
      '/api/addresses',
      {
        schema: {
          tags: ['addresses'],
          summary: 'List my addresses',
          security: [{ bearerAuth: [] }],
        },
      },
      async (req) => service.listForUser(req.user!.id),
    );

    auth.post(
      '/api/addresses',
      {
        schema: {
          tags: ['addresses'],
          summary: 'Create an address',
          body: AddressBody,
          security: [{ bearerAuth: [] }],
        },
      },
      async (req, reply) => {
        const created = await service.create(req.user!.id, req.body);
        return reply.status(201).send(created);
      },
    );

    auth.put(
      '/api/addresses/:id',
      {
        schema: {
          tags: ['addresses'],
          summary: 'Update an address',
          params: z.object({ id: z.string().uuid() }),
          body: AddressBody.partial(),
          security: [{ bearerAuth: [] }],
        },
      },
      async (req, reply) => {
        try {
          return await service.update(req.user!.id, req.params.id, req.body);
        } catch (err) {
          if (err instanceof Error && err.message === 'ADDRESS_NOT_FOUND') {
            return reply.notFound('Address not found');
          }
          throw err;
        }
      },
    );

    auth.delete(
      '/api/addresses/:id',
      {
        schema: {
          tags: ['addresses'],
          summary: 'Delete an address',
          params: z.object({ id: z.string().uuid() }),
          security: [{ bearerAuth: [] }],
        },
      },
      async (req, reply) => {
        try {
          await service.delete(req.user!.id, req.params.id);
          return reply.status(204).send();
        } catch (err) {
          if (err instanceof Error && err.message === 'ADDRESS_NOT_FOUND') {
            return reply.notFound('Address not found');
          }
          throw err;
        }
      },
    );
  });
}
