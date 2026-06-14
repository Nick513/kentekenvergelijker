import { createClient } from "@supabase/supabase-js";
import ws from "ws";
import { getSupabaseServiceRoleKey, getSupabaseUrl } from "@/lib/supabase/env";

export function createSupabaseServerClient() {
  return createClient(getSupabaseUrl(), getSupabaseServiceRoleKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    realtime: { transport: ws },
  });
}
