/**
 * Supabase client for server-side use in Next.js API routes.
 *
 * Uses the service role key so it bypasses Row Level Security.
 * Never expose this client or SUPABASE_SERVICE_ROLE_KEY to the browser.
 *
 * Required env vars:
 *   SUPABASE_URL              – e.g. https://xyzcompany.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY – service role JWT from Supabase project settings
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  // During build or test, env vars may not be present — warn but don't crash.
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables."
    );
  }
}

/**
 * Typed server-side Supabase client.
 * Use this in Next.js API route handlers (app/api/route.ts files).
 */
export const supabase: SupabaseClient<Database> = createClient<Database>(
  supabaseUrl ?? "",
  supabaseServiceRoleKey ?? "",
  {
    auth: {
      // Disable auto-refresh and session management — this is a server client.
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export default supabase;
