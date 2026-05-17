import fp from 'fastify-plugin';
import { ZodError } from 'zod';
import { Prisma } from '@vivasvana/db';

export default fp(
  async (app) => {
    app.setErrorHandler((err, req, reply) => {
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
        app.log.error({ err }, 'prisma known request error');
        return reply.status(500).send({ error: 'DatabaseError', message: 'Database error' });
      }

      // Fastify HTTP errors (from @fastify/sensible) carry statusCode
      if (err.statusCode && err.statusCode < 500) {
        return reply.status(err.statusCode).send({
          error: err.name ?? 'Error',
          message: err.message,
        });
      }

      app.log.error({ err, url: req.url }, 'unhandled error');
      return reply.status(500).send({ error: 'InternalServerError', message: 'Something went wrong' });
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
