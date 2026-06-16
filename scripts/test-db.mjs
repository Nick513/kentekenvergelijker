import { createClient } from "@supabase/supabase-js";

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
  });

  const { count, error: countError } = await supabase
    .from("vehicle_configurations")
    .select("*", { count: "exact", head: true });

  if (countError) {
    throw new Error(`Read failed: ${countError.message}`);
  }

  console.log(`  vehicle_configurations rows: ${count ?? 0}`);

  const { error: plateTableError } = await supabase
    .from("plate_specification_values")
    .select("license_plate", { count: "exact", head: true });

  if (plateTableError) {
    throw new Error(
      `plate_specification_values not available: ${plateTableError.message}. Apply migration 20260616134123_plate_enrichment.sql.`,
    );
  }

  console.log("  plate_specification_values table: OK");

  const testCatalogKey = `test_${Date.now()}`;
  const testConfiguration = {
    brand: "TEST",
    model_name: "Database connectivity check",
    trim_name: "Base",
    catalog_key: testCatalogKey,
  };

  console.log("Inserting test configuration...");
  const { data: inserted, error: insertError } = await supabase
    .from("vehicle_configurations")
    .insert(testConfiguration)
    .select("id, brand, model_name, trim_name, catalog_key, created_at")
    .single();

  if (insertError) {
    throw new Error(`Insert failed: ${insertError.message}`);
  }

  console.log("Read back test configuration:");
  console.log(`  ${JSON.stringify(inserted)}`);

  console.log("Inserting test specification value...");
  const { error: specInsertError } = await supabase
    .from("vehicle_configuration_specification_values")
    .insert({
      vehicle_configuration_id: inserted.id,
      spec_key: "fuel_type",
      value_text: "Test",
      source: "test",
    });

  if (specInsertError) {
    throw new Error(`Spec insert failed: ${specInsertError.message}`);
  }

  console.log("Deleting test configuration...");
  const { error: deleteError } = await supabase
    .from("vehicle_configurations")
    .delete()
    .eq("id", inserted.id);

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
