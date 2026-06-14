import { createClient } from "@supabase/supabase-js";
import ws from "ws";

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

async function main() {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    realtime: { transport: ws },
  });

  const { count, error: countError } = await supabase
    .from("comparison_specifications")
    .select("*", { count: "exact", head: true })
    .eq("is_active", true);

  if (countError) {
    throw new Error(
      `comparison_specifications not available: ${countError.message}. Run the migration first.`,
    );
  }

  console.log(`Active comparison specifications: ${count ?? 0}`);

  const { data, error } = await supabase
    .from("comparison_specifications")
    .select("group_label, label, value_source, value_key")
    .eq("is_active", true)
    .order("group_sort_order", { ascending: true })
    .order("sort_order", { ascending: true })
    .limit(8);

  if (error) {
    throw new Error(`Read failed: ${error.message}`);
  }

  console.log("First rows:");
  for (const row of data ?? []) {
    console.log(`  [${row.group_label}] ${row.label} (${row.value_source}/${row.value_key})`);
  }

  console.log("Specifications test passed.");
}

main().catch((error) => {
  console.error("Specifications test failed.");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
