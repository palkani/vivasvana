import Fastify, { type FastifyServerOptions } from 'fastify';
import sensible from '@fastify/sensible';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import cookie from '@fastify/cookie';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import {
  serializerCompiler,
  validatorCompiler,
  jsonSchemaTransform,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';

import prismaPlugin from './plugins/prisma.js';
import redisPlugin from './plugins/redis.js';
import authPlugin from './plugins/auth.js';
import errorHandler from './plugins/error-handler.js';
import { env } from './config/env.js';

import healthRoutes from './routes/health.js';
import productRoutes from './routes/products.js';
import adminProductRoutes from './routes/admin/products.js';
import adminReportsRoutes from './routes/admin/reports.js';
import adminOrderRoutes from './routes/admin/orders.js';
import adminDiscountRoutes from './routes/admin/discounts.js';
import adminCustomerRoutes from './routes/admin/customers.js';
import adminBlogRoutes from './routes/admin/blog.js';
import adminSettingsRoutes from './routes/admin/settings.js';
import adminStaffRoutes from './routes/admin/staff.js';
import adminMeRoute from './routes/admin/me.js';
import blogRoutes from './routes/blog.js';
import cartRoutes from './routes/cart.js';
import addressRoutes from './routes/addresses.js';
import indiaPostRoutes from './routes/india-post.js';
import discountRoutes from './routes/discounts.js';
import orderRoutes from './routes/orders.js';
import paymentRoutes from './routes/payments.js';
import testimonialRoutes from './routes/testimonials.js';
import contactRoutes from './routes/contact.js';
import authRoutes from './routes/auth.js';

export async function buildApp(opts: FastifyServerOptions = {}) {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === 'production' ? 'info' : 'debug',
      transport:
        env.NODE_ENV === 'development'
          ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } }
          : undefined,
    },
    trustProxy: true,
    bodyLimit: 1_000_000, // 1MB; product image uploads go direct to Supabase Storage
    ...opts,
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // Core hardening
  await app.register(helmet, { contentSecurityPolicy: false });
  // Origins: comma-separated list, each entry is either:
  //   - a literal origin    e.g.  https://vivasvana.vercel.app
  //   - a wildcard pattern  e.g.  https://*.vercel.app  or  https://vivasvana-*-vivasvana-s-projects.vercel.app
  // Vercel mints a fresh per-deployment hostname (xxxxx.vercel.app) on
  // every push — a literal allowlist can't keep up, so we support `*`
  // segments by compiling them into RegExp. `*` matches one or more
  // non-`/` chars, which is tight enough that an open `https://*` still
  // wouldn't accidentally allow malicious origins on unrelated TLDs.
  const corsOrigins = env.API_CORS_ORIGINS.split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((entry) => {
      if (!entry.includes('*')) return entry;
      const regexBody = entry
        .split('*')
        .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
        .join('[^/]+');
      return new RegExp(`^${regexBody}$`);
    });
  app.log.info(
    {
      origins: corsOrigins.map((o) => (o instanceof RegExp ? `regex:${o.source}` : o)),
    },
    'cors allowlist resolved',
  );
  await app.register(cors, {
    origin: corsOrigins,
    credentials: true,
  });
  await app.register(cookie);
  await app.register(sensible);
  await app.register(rateLimit, {
    max: 200,
    timeWindow: '1 minute',
    allowList: env.NODE_ENV === 'test' ? ['127.0.0.1'] : [],
  });

  // App plugins (order matters: prisma → auth depends on it)
  await app.register(prismaPlugin);
  await app.register(redisPlugin);
  await app.register(authPlugin);
  await app.register(errorHandler);

  // OpenAPI / Swagger UI
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Vivasvana API',
        description: 'Ecommerce REST API for Vivasvana (millet nutrition brand)',
        version: '0.1.0',
      },
      servers: [{ url: env.API_URL }],
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        },
      },
    },
    transform: jsonSchemaTransform,
  });
  await app.register(swaggerUi, { routePrefix: '/docs' });

  // Routes
  await app.register(healthRoutes);
  await app.register(productRoutes);
  await app.register(adminProductRoutes);
  await app.register(adminReportsRoutes);
  await app.register(adminOrderRoutes);
  await app.register(adminDiscountRoutes);
  await app.register(adminCustomerRoutes);
  await app.register(adminBlogRoutes);
  await app.register(adminSettingsRoutes);
  await app.register(adminStaffRoutes);
  await app.register(adminMeRoute);
  await app.register(blogRoutes);
  await app.register(cartRoutes);
  await app.register(addressRoutes);
  await app.register(indiaPostRoutes);
  await app.register(discountRoutes);
  await app.register(orderRoutes);
  await app.register(paymentRoutes);
  await app.register(testimonialRoutes);
  await app.register(contactRoutes);
  await app.register(authRoutes);
  // future: blog…

  return app;
}

export type App = Awaited<ReturnType<typeof buildApp>>;
