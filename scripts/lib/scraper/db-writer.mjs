// Idempotent Supabase writers for the catalog tables.
// Re-running a scrape must refresh data without duplicates or errors.

import { createClient } from "@supabase/supabase-js";
import ws from "ws";

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

/** Create a Supabase client with the service role key (writes bypass RLS). */
export function createCatalogClient() {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    realtime: { transport: ws },
  });
}

/**
 * Upsert one vehicle_configurations row by catalog_key and return its id.
 * ON CONFLICT (catalog_key) DO UPDATE keeps the row fresh on re-runs.
 *
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {{ brand: string, modelName: string, trimName: string, catalogKey: string }} config
 * @returns {Promise<string>} vehicle_configuration id
 */
export async function upsertVehicleConfiguration(supabase, config) {
  const { data, error } = await supabase
    .from("vehicle_configurations")
    .upsert(
      {
        brand: config.brand,
        model_name: config.modelName,
        trim_name: config.trimName,
        catalog_key: config.catalogKey,
      },
      { onConflict: "catalog_key" },
    )
    .select("id")
    .single();

  if (error) {
    throw new Error(
      `Upsert vehicle_configurations failed for ${config.catalogKey}: ${error.message}`,
    );
  }

  return data.id;
}

/**
 * Upsert spec value rows for a configuration. Composite PK
 * (vehicle_configuration_id, spec_key) makes this idempotent.
 *
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {string} vehicleConfigurationId
 * @param {Array<{ spec_key: string, value_text?: string, value_numeric?: number, value_boolean?: boolean }>} specValues
 * @param {string} source e.g. "scraped_hyundai"
 * @returns {Promise<number>} number of rows written
 */
export async function upsertSpecValues(
  supabase,
  vehicleConfigurationId,
  specValues,
  source,
) {
  if (specValues.length === 0) {
    return 0;
  }

  const rows = specValues.map((value) => ({
    vehicle_configuration_id: vehicleConfigurationId,
    spec_key: value.spec_key,
    value_text: value.value_text ?? null,
    value_numeric: value.value_numeric ?? null,
    value_boolean: value.value_boolean ?? null,
    source,
  }));

  const { error } = await supabase
    .from("vehicle_configuration_specification_values")
    .upsert(rows, { onConflict: "vehicle_configuration_id,spec_key" });

  if (error) {
    throw new Error(
      `Upsert spec values failed for ${vehicleConfigurationId}: ${error.message}`,
    );
  }

  return rows.length;
}
