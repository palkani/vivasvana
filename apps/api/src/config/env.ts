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
  SHIPROCKET_EMAIL: z.string().optional(),
  SHIPROCKET_PASSWORD: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

let _env: Env | undefined;

export function loadEnv(): Env {
  if (_env) return _env;
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('Invalid environment variables:');
    console.error(parsed.error.flatten().fieldErrors);
    process.exit(1);
  }
  _env = parsed.data;
  return _env;
}

export const env = new Proxy({} as Env, {
  get(_, key: string) {
    return loadEnv()[key as keyof Env];
  },
});
