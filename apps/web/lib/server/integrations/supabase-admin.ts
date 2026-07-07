import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env';

/**
 * Server-side Supabase client using the service role key. Used to bypass
 * Supabase's email-confirmation step — we run our own OTP via Resend, so
 * once the shopper proves they own the inbox we create the auth user with
 * `email_confirm: true` and hand back a session.
 *
 * NEVER expose this client to the browser; service_role bypasses all RLS.
 */
let _admin: SupabaseClient | null = null;
export function supabaseAdmin(): SupabaseClient {
  if (_admin) return _admin;
  _admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
  return _admin;
}
