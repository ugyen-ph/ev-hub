// Shared Supabase browser client for the admin dashboard.
// The publishable key is safe in the browser: Row Level Security is the
// gatekeeper, and every admin-only action additionally requires
// profiles.role = 'admin' (enforced by the is_admin() SQL helper inside
// the RLS policies — see supabase/migrations/0003 + 0006).

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

/** Human-readable hint when the env file is missing (shown in the UI, never thrown — keeps `next build` green). */
export function getSupabaseEnvError(): string | null {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    return 'admin/.env is missing — copy admin/.env.example, paste your Supabase URL + publishable key, then restart `npm run dev`.';
  }
  return null;
}

/** Lazily-created singleton. Returns null (instead of throwing) when env vars are missing. */
export function getSupabase(): SupabaseClient | null {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  client = createClient(url, key);
  return client;
}
