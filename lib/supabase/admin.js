import { createClient } from "@supabase/supabase-js";

/* Admin Supabase client for trusted server-to-server work (Stripe webhooks).
   Uses the SECRET key, which bypasses Row-Level Security, so it must only ever
   be used on the server, never imported into a "use client" component. */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
