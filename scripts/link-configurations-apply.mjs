// Apply owner-approved configuration_links from the suggestions CSV.
// Only rows with approved in {yes,y,true,1} are written. Upsert is idempotent on
// the (vehicle_configuration_id, configuration_key) primary key.
//
// Usage:
//   node --env-file=.env.local scripts/link-configurations-apply.mjs [--file path/to.csv]

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { createCatalogClient } from "./lib/scraper/db-writer.mjs";
import { logger } from "./lib/scraper/logger.mjs";
import { parseCsv } from "./lib/scraper/csv.mjs";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_FILE = path.join(
  moduleDir,
  "output",
  "configuration-links-suggested.csv",
);

const APPROVED_VALUES = new Set(["yes", "y", "true", "1"]);

function parseCliArgs() {
  const { values } = parseArgs({
    options: { file: { type: "string", default: DEFAULT_FILE } },
  });
  return values;
}

async function main() {
  const args = parseCliArgs();
  const csvText = await readFile(args.file, "utf8");
  const rows = parseCsv(csvText);

  const approved = rows.filter((row) =>
    APPROVED_VALUES.has(String(row.approved ?? "").trim().toLowerCase()),
  );

  if (approved.length === 0) {
    logger.warn("No approved rows (set approved=yes). Nothing to apply.");
    return;
  }

  const supabase = createCatalogClient();

  // Resolve catalog_key -> vehicle_configuration id once.
  const catalogKeys = [...new Set(approved.map((row) => row.catalog_key))];
  const { data: configs, error: configError } = await supabase
    .from("vehicle_configurations")
    .select("id, catalog_key")
    .in("catalog_key", catalogKeys);
  if (configError) throw new Error(`Load configs failed: ${configError.message}`);

  const idByCatalogKey = new Map(
    (configs ?? []).map((row) => [row.catalog_key, row.id]),
  );

  const links = [];
  for (const row of approved) {
    const vehicleConfigurationId = idByCatalogKey.get(row.catalog_key);
    if (!vehicleConfigurationId) {
      logger.warn(`Skipping unknown catalog_key: ${row.catalog_key}`);
      continue;
    }
    links.push({
      vehicle_configuration_id: vehicleConfigurationId,
      configuration_key: row.configuration_key,
    });
  }

  if (links.length === 0) {
    logger.warn("No resolvable links to write.");
    return;
  }

  const { error } = await supabase
    .from("configuration_links")
    .upsert(links, { onConflict: "vehicle_configuration_id,configuration_key" });
  if (error) throw new Error(`Write links failed: ${error.message}`);

  logger.info(`Applied ${links.length} configuration_links.`);
}

main().catch((error) => {
  logger.error("Link apply failed.");
  logger.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
