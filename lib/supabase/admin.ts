import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/supabase/env";

export function createAdminClient() {
  if (!env.supabaseServiceRoleKey) {
    throw new Error("Missing environment variable: SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}