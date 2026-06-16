import fp from 'fastify-plugin';
import type { FastifyError } from 'fastify';
import { ZodError } from 'zod';
import { Prisma } from '@vivasvana/db';

/**
 * Default ON — 500 responses include the underlying error name, code,
 * and short message. Same data that's already in app.log.error, just
 * curl-able from outside so we can diagnose without log access. Stack
 * traces are NEVER included.
 *
 * To suppress in production (so error-class names like
 * "PrismaClientKnown..." don't leak ORM choice), set
 * EXPOSE_ERROR_DETAILS=false on the prod env. Anywhere else, leave
 * unset — diagnosability beats marginal info leakage in QA.
 */
function detailsIfExposed(err: unknown) {
  if (process.env.EXPOSE_ERROR_DETAILS === 'false') return {};
  if (!(err instanceof Error)) return { detail: { type: typeof err } };
  const out: Record<string, unknown> = {
    detail: {
      name: err.name,
      message: err.message,
    },
  };
  if ('code' in err && typeof err.code === 'string') {
    (out.detail as Record<string, unknown>).code = err.code;
  }
  return out;
}

export default fp(
  async (app) => {
    app.setErrorHandler((err: FastifyError, req, reply) => {
      if (err instanceof ZodError) {
        return reply.status(400).send({
          error: 'ValidationError',
          message: 'Invalid request payload',
          issues: err.flatten().fieldErrors,
        });
      }

      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === 'P2002') {
          return reply
            .status(409)
            .send({ error: 'Conflict', message: 'Resource already exists', meta: err.meta });
        }
        if (err.code === 'P2025') {
          return reply.status(404).send({ error: 'NotFound', message: 'Resource not found' });
        }
        app.log.error({ err, url: req.url }, 'prisma known request error');
        return reply.status(500).send({
          error: 'DatabaseError',
          message: 'Database error',
          ...detailsIfExposed(err),
        });
      }

      // Fastify HTTP errors (from @fastify/sensible) carry statusCode
      if (err.statusCode && err.statusCode < 500) {
        return reply.status(err.statusCode).send({
          error: err.name ?? 'Error',
          message: err.message,
        });
      }

      // Catch-all for unknown errors. Log with a stable fingerprint so we can
      // grep Railway for it and surface as much as the operator allows via
      // EXPOSE_ERROR_DETAILS.
      const errType =
        err instanceof Error
          ? `${err.constructor.name}${'code' in err && err.code ? `:${err.code}` : ''}`
          : typeof err;
      app.log.error(
        { err, url: req.url, errType, method: req.method },
        'unhandled error',
      );
      return reply.status(500).send({
        error: 'InternalServerError',
        message: 'Something went wrong',
        ...detailsIfExposed(err),
      });
    });

    app.setNotFoundHandler((req, reply) => {
      return reply.status(404).send({
        error: 'NotFound',
        message: `Route ${req.method} ${req.url} not found`,
      });
    });
  },
  { name: 'error-handler' },
);
