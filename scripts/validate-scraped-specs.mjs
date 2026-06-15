// Validate scraped catalog coverage against the specifications blueprint.
// Reports, per scraped vehicle_configuration: which PoC target spec_keys are
// present, which are missing, and flags any spec values whose key is unknown.
//
// Usage:
//   node --env-file=.env.local scripts/validate-scraped-specs.mjs [--brand Hyundai] [--model i20]

import { parseArgs } from "node:util";
import { createCatalogClient } from "./lib/scraper/db-writer.mjs";
import { loadSpecCatalog } from "./lib/scraper/field-map.mjs";
import { logger } from "./lib/scraper/logger.mjs";

// PoC target spec keys from the plan (section 8). Brochure gaps for these are
// expected until additional sources are added; the report lists them clearly.
const POC_TARGET_SPEC_KEYS = [
  "trim_package",
  "transmission",
  "acceleration_0_100",
  "top_speed",
  "luggage_volume",
  "drive_wheels",
  "max_power_engine",
  "fuel_consumption_combined_nedc",
  "heated_seats",
  "navigation",
  "apple_carplay",
  "lane_assist",
  "parking_camera",
  "led_headlights",
  "cruise_control",
  "dual_zone_climate_control",
];

function parseCliArgs() {
  const { values } = parseArgs({
    options: {
      brand: { type: "string" },
      model: { type: "string" },
    },
  });
  return values;
}

async function main() {
  const args = parseCliArgs();
  const supabase = createCatalogClient();
  const specCatalog = await loadSpecCatalog(supabase);

  let configQuery = supabase
    .from("vehicle_configurations")
    .select("id, brand, model_name, trim_name, catalog_key")
    .not("catalog_key", "like", "rdw:%");

  if (args.brand) configQuery = configQuery.ilike("brand", args.brand);
  if (args.model) configQuery = configQuery.ilike("model_name", args.model);

  const { data: configs, error: configError } = await configQuery;
  if (configError) {
    throw new Error(`Failed to load configurations: ${configError.message}`);
  }

  if (!configs || configs.length === 0) {
    logger.warn("No scraped configurations found. Run the scraper first.");
    return;
  }

  logger.info(`Validating ${configs.length} scraped configurations`);

  let totalMissing = 0;
  let totalUnknownKeys = 0;
  const missingByKey = new Map();

  for (const config of configs) {
    const { data: specRows, error: specError } = await supabase
      .from("vehicle_configuration_specification_values")
      .select("spec_key, source")
      .eq("vehicle_configuration_id", config.id);

    if (specError) {
      throw new Error(`Failed to load spec values: ${specError.message}`);
    }

    const presentKeys = new Set((specRows ?? []).map((row) => row.spec_key));

    const unknownKeys = [...presentKeys].filter((key) => !specCatalog.has(key));
    totalUnknownKeys += unknownKeys.length;

    const missing = POC_TARGET_SPEC_KEYS.filter((key) => !presentKeys.has(key));
    totalMissing += missing.length;
    for (const key of missing) {
      missingByKey.set(key, (missingByKey.get(key) ?? 0) + 1);
    }

    const sources = [...new Set((specRows ?? []).map((row) => row.source))];
    logger.info(
      `${config.catalog_key} :: ${presentKeys.size} specs, ` +
        `${missing.length} target gaps, sources=[${sources.join(", ")}]`,
    );
    if (unknownKeys.length > 0) {
      logger.warn(`  unknown spec_keys: ${unknownKeys.join(", ")}`);
    }
  }

  logger.info("Coverage gaps across PoC target spec_keys (count of configs missing each):");
  const sortedGaps = [...missingByKey.entries()].sort((a, b) => b[1] - a[1]);
  for (const [key, count] of sortedGaps) {
    logger.info(`  ${key}: missing in ${count}/${configs.length}`);
  }

  logger.info(
    `Validation done. configs=${configs.length} totalTargetGaps=${totalMissing} unknownKeys=${totalUnknownKeys}`,
  );

  if (totalUnknownKeys > 0) {
    logger.error("Found spec values with unknown spec_keys (FK should prevent this).");
    process.exit(1);
  }
}

main().catch((error) => {
  logger.error("Validation failed.");
  logger.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
