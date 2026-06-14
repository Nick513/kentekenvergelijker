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

  console.log("Connecting to Supabase...");
  console.log(`  URL: ${url}`);

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    realtime: { transport: ws },
  });

  const { count, error: countError } = await supabase
    .from("vehicle_configurations")
    .select("*", { count: "exact", head: true });

  if (countError) {
    throw new Error(`Read failed: ${countError.message}`);
  }

  console.log(`  vehicle_configurations rows: ${count ?? 0}`);

  const testKey = `test_${Date.now()}`;
  const testRow = {
    configuration_key: testKey,
    brand: "TEST",
    model_name: "Database connectivity check",
    fuel_type: "Test",
    rdw_vehicle: { test: true },
    source: "rdw",
  };

  console.log("Inserting test row...");
  const { error: insertError } = await supabase
    .from("vehicle_configurations")
    .insert(testRow);

  if (insertError) {
    throw new Error(`Insert failed: ${insertError.message}`);
  }

  const { data, error: selectError } = await supabase
    .from("vehicle_configurations")
    .select("configuration_key, brand, model_name, created_at: fetched_at")
    .eq("configuration_key", testKey)
    .single();

  if (selectError) {
    throw new Error(`Select failed: ${selectError.message}`);
  }

  console.log("Read back test row:");
  console.log(`  ${JSON.stringify(data)}`);

  console.log("Deleting test row...");
  const { error: deleteError } = await supabase
    .from("vehicle_configurations")
    .delete()
    .eq("configuration_key", testKey);

  if (deleteError) {
    throw new Error(`Delete failed: ${deleteError.message}`);
  }

  console.log("Database test passed.");
}

main().catch((error) => {
  console.error("Database test failed.");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
