import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  API_PORT: z.coerce.number().int().positive().default(4000),
  API_HOST: z.string().default('0.0.0.0'),
  API_URL: z.string().url().default('http://localhost:4000'),
  API_CORS_ORIGINS: z.string().default('http://localhost:3000'),

  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url().optional(),

  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_JWT_SECRET: z.string().min(32),

  REDIS_URL: z.string().default('redis://127.0.0.1:6379'),

  JWT_SECRET: z.string().min(32),

  // optional integrations — required only for the phases that need them
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  // Shiprocket — aggregator for Indian couriers. Pickup location is the
  // name given to the warehouse address in Shiprocket dashboard (not an
  // address). Webhook token is a free-form string we choose; we configure
  // it in Shiprocket dashboard as `x-api-key` and verify on incoming
  // webhook calls. Without creds the integration runs in stub mode
  // (logs everything, returns mock data) so the full flow stays testable.
  SHIPROCKET_EMAIL: z.string().optional(),
  SHIPROCKET_PASSWORD: z.string().optional(),
  SHIPROCKET_PICKUP_LOCATION: z.string().default('Primary'),
  SHIPROCKET_WEBHOOK_TOKEN: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),

  // Gate the email-OTP step at checkout. Default is "off" so local dev,
  // CI, and integration tests don't have to thread a fresh OTP through
  // every order. QA + production deployments set this to "true" via env
  // so real shoppers must confirm their email at place-order time.
  REQUIRE_ORDER_OTP: z
    .string()
    .optional()
    .transform((v) => v === 'true' || v === '1'),

  // Twilio SMS — all four are optional individually; sendSms() degrades to a
  // dev-mode console log when SID/token are missing. In production, set at
  // least SID + token + either FROM_NUMBER or MESSAGING_SERVICE_SID.
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_FROM_NUMBER: z.string().optional(),
  TWILIO_MESSAGING_SERVICE_SID: z.string().optional(),

  // Dev-only admin bypass — IGNORED when NODE_ENV=production (see auth plugin).
  ADMIN_AUTH_DISABLED: z
    .string()
    .optional()
    .transform((v) => v === 'true' || v === '1'),
});

export type Env = z.infer<typeof EnvSchema>;

let _env: Env | undefined;

export function loadEnv(): Env {
  if (_env) return _env;
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    // Serverless: NEVER process.exit() — that would tear down the whole
    // function instance (and any other in-flight requests) over one bad var.
    // Throw so the failure is scoped to the request and surfaces through the
    // route error handler as a 500 with a clear message.
    const fields = parsed.error.flatten().fieldErrors;
    console.error('Invalid environment variables:', fields);
    throw new Error(`Invalid environment variables: ${Object.keys(fields).join(', ')}`);
  }
  _env = parsed.data;
  return _env;
}

export const env = new Proxy({} as Env, {
  get(_, key: string) {
    return loadEnv()[key as keyof Env];
  },
});
