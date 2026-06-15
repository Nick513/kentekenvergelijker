// Suggest configuration_links between RDW configurations and scraped catalog
// rows. This script NEVER writes to the database; it writes a CSV of proposed
// links for the owner to review. Approve rows (set approved=yes) and apply them
// with scripts/link-configurations-apply.mjs.
//
// Usage:
//   node --env-file=.env.local scripts/link-configurations.mjs [--brand Hyundai] [--model i20] [--min-confidence 0.5]

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { createCatalogClient } from "./lib/scraper/db-writer.mjs";
import { logger } from "./lib/scraper/logger.mjs";
import { toCsv } from "./lib/scraper/csv.mjs";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(moduleDir, "output");

const DISPLACEMENT_TOLERANCE_CC = 60;
const POWER_TOLERANCE_KW = 4;

function parseCliArgs() {
  const { values } = parseArgs({
    options: {
      brand: { type: "string" },
      model: { type: "string" },
      "min-confidence": { type: "string", default: "0.5" },
    },
  });
  return values;
}

function firstFuelRecord(rdwFuel) {
  if (Array.isArray(rdwFuel)) return rdwFuel[0] ?? {};
  if (rdwFuel && typeof rdwFuel === "object") return rdwFuel;
  return {};
}

function normalizeFuel(value) {
  return String(value ?? "").trim().toLowerCase();
}

function describeRdwConfiguration(row) {
  const vehicle = row.rdw_vehicle ?? {};
  const fuel = firstFuelRecord(row.rdw_fuel);
  const displacement = Number.parseInt(vehicle.cilinderinhoud, 10);
  const power = Number.parseFloat(
    fuel.nettomaximumvermogen ?? fuel.netto_max_vermogen_elektrisch,
  );

  return {
    configurationKey: row.configuration_key,
    brand: (vehicle.merk ?? "").trim(),
    model: (vehicle.handelsbenaming ?? "").trim(),
    displacementCc: Number.isFinite(displacement) ? displacement : null,
    powerKw: Number.isFinite(power) ? power : null,
    fuel: normalizeFuel(fuel.brandstof_omschrijving),
  };
}

function scoreMatch(rdw, catalog) {
  let confidence = 0;
  const reasons = ["brand+model"];

  if (
    rdw.displacementCc !== null &&
    catalog.displacementCc !== null &&
    Math.abs(rdw.displacementCc - catalog.displacementCc) <= DISPLACEMENT_TOLERANCE_CC
  ) {
    confidence += 0.4;
    reasons.push("displacement");
  }

  if (
    rdw.powerKw !== null &&
    catalog.powerKw !== null &&
    Math.abs(rdw.powerKw - catalog.powerKw) <= POWER_TOLERANCE_KW
  ) {
    confidence += 0.3;
    reasons.push("power");
  }

  if (rdw.fuel && catalog.fuel && rdw.fuel.includes(catalog.fuel.split(" ")[0])) {
    confidence += 0.3;
    reasons.push("fuel");
  }

  return { confidence: Math.min(confidence, 1), reasons };
}

async function loadCatalogConfigurations(supabase, args) {
  let query = supabase
    .from("vehicle_configurations")
    .select("id, brand, model_name, catalog_key")
    .not("catalog_key", "like", "rdw:%");

  if (args.brand) query = query.ilike("brand", args.brand);
  if (args.model) query = query.ilike("model_name", args.model);

  const { data, error } = await query;
  if (error) throw new Error(`Load catalog failed: ${error.message}`);

  const catalogs = [];
  for (const row of data ?? []) {
    const { data: specs } = await supabase
      .from("vehicle_configuration_specification_values")
      .select("spec_key, value_text, value_numeric")
      .eq("vehicle_configuration_id", row.id)
      .in("spec_key", ["fuel_type", "power_kw", "engine_displacement_cc"]);

    const byKey = new Map((specs ?? []).map((s) => [s.spec_key, s]));
    catalogs.push({
      catalogKey: row.catalog_key,
      brand: row.brand,
      model: row.model_name,
      fuel: normalizeFuel(byKey.get("fuel_type")?.value_text),
      powerKw: byKey.get("power_kw")?.value_numeric ?? null,
      displacementCc: byKey.get("engine_displacement_cc")?.value_numeric ?? null,
    });
  }
  return catalogs;
}

async function main() {
  const args = parseCliArgs();
  const minConfidence = Number.parseFloat(args["min-confidence"]);
  const supabase = createCatalogClient();

  const { data: rdwRows, error: rdwError } = await supabase
    .from("configurations")
    .select("configuration_key, rdw_vehicle, rdw_fuel");
  if (rdwError) throw new Error(`Load configurations failed: ${rdwError.message}`);

  if (!rdwRows || rdwRows.length === 0) {
    logger.warn("No RDW configurations cached. Nothing to link.");
    return;
  }

  const catalogs = await loadCatalogConfigurations(supabase, args);
  if (catalogs.length === 0) {
    logger.warn("No scraped catalog configurations found. Run the scraper first.");
    return;
  }

  logger.info(
    `Scoring ${rdwRows.length} RDW configurations against ${catalogs.length} catalog rows`,
  );

  const suggestions = [];
  for (const row of rdwRows) {
    const rdw = describeRdwConfiguration(row);
    if (!rdw.brand || !rdw.model) continue;

    for (const catalog of catalogs) {
      const sameBrand = rdw.brand.toLowerCase() === catalog.brand.toLowerCase();
      const sameModel =
        rdw.model.toLowerCase().includes(catalog.model.toLowerCase()) ||
        catalog.model.toLowerCase().includes(rdw.model.toLowerCase());
      if (!sameBrand || !sameModel) continue;

      const { confidence, reasons } = scoreMatch(rdw, catalog);
      if (confidence >= minConfidence) {
        suggestions.push({
          configuration_key: rdw.configurationKey,
          catalog_key: catalog.catalogKey,
          confidence: confidence.toFixed(2),
          reason: reasons.join("+"),
          approved: "",
        });
      }
    }
  }

  suggestions.sort(
    (a, b) =>
      Number.parseFloat(b.confidence) - Number.parseFloat(a.confidence),
  );

  await mkdir(OUTPUT_DIR, { recursive: true });
  const outFile = path.join(OUTPUT_DIR, "configuration-links-suggested.csv");
  await writeFile(
    outFile,
    toCsv(
      ["configuration_key", "catalog_key", "confidence", "reason", "approved"],
      suggestions,
    ),
    "utf8",
  );

  logger.info(`Wrote ${suggestions.length} suggestions to ${outFile}`);
  logger.info(
    "Review the file, set approved=yes on rows to keep, then run: npm run link:apply",
  );
}

main().catch((error) => {
  logger.error("Link suggestion failed.");
  logger.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
