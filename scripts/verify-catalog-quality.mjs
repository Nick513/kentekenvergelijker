// Catalog data quality checks: coverage depth, source conflicts, known plate regression.
//
// Usage:
//   node --env-file=.env.local scripts/verify-catalog-quality.mjs
//   npm run verify:catalog

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createCatalogClient } from "./lib/catalog/db.mjs";
import { loadSpecCatalog } from "./lib/catalog/spec-catalog.mjs";
import { logger } from "./lib/catalog/logger.mjs";
import {
  engineSlugFromCatalogKey,
  filterModelMatches,
  resolveConfigurationId,
  trimSlugFromCatalogKey,
} from "./lib/verification/plate-catalog-resolve.mjs";
import {
  pickCo2EmissionGKm,
  pickFuelType,
  pickPowerKw,
} from "./lib/verification/rdw-snapshot.mjs";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const KNOWN_PLATES_PATH = path.join(
  moduleDir,
  "lib/verification/known-plates.json",
);

const MIN_SPECS_PER_CONFIG = 8;
const BROCHURE_SOURCE_PREFIX = "scraped_";

async function checkCatalogDepth(supabase) {
  const { data: configs, error } = await supabase
    .from("vehicle_configurations")
    .select("id, brand, model_name, catalog_key")
    .not("catalog_key", "like", "rdw:%");

  if (error) throw new Error(error.message);

  let thin = 0;
  let total = 0;

  for (const config of configs ?? []) {
    const { count } = await supabase
      .from("vehicle_configuration_specification_values")
      .select("spec_key", { count: "exact", head: true })
      .eq("vehicle_configuration_id", config.id);

    total += 1;
    const specCount = count ?? 0;
    if (specCount < MIN_SPECS_PER_CONFIG) {
      thin += 1;
      logger.warn(
        `Thin coverage: ${config.catalog_key} has ${specCount} specs (min ${MIN_SPECS_PER_CONFIG})`,
      );
    }
  }

  return { total, thin };
}

async function checkSourceConflicts(supabase) {
  const { data: configs } = await supabase
    .from("vehicle_configurations")
    .select("id, catalog_key")
    .not("catalog_key", "like", "rdw:%");

  let conflicts = 0;

  for (const config of configs ?? []) {
    const { data: rows } = await supabase
      .from("vehicle_configuration_specification_values")
      .select("spec_key, source, value_text, value_numeric, value_boolean")
      .eq("vehicle_configuration_id", config.id);

    const byKey = new Map();
    for (const row of rows ?? []) {
      const list = byKey.get(row.spec_key) ?? [];
      list.push(row);
      byKey.set(row.spec_key, list);
    }

    for (const [specKey, entries] of byKey.entries()) {
      const brochure = entries.filter((e) => e.source?.startsWith(BROCHURE_SOURCE_PREFIX));
      const listing = entries.filter((e) => !e.source?.startsWith(BROCHURE_SOURCE_PREFIX));
      if (brochure.length === 0 || listing.length === 0) continue;

      const serialize = (e) =>
        JSON.stringify([e.value_text, e.value_numeric, e.value_boolean]);
      const brochureValues = new Set(brochure.map(serialize));
      const listingValues = new Set(listing.map(serialize));

      if (brochureValues.size > 1 || listingValues.size > 1) continue;

      const b = [...brochureValues][0];
      const l = [...listingValues][0];
      if (b !== l) {
        conflicts += 1;
        logger.warn(
          `Source conflict on ${config.catalog_key} :: ${specKey} (brochure vs listing differ)`,
        );
      }
    }
  }

  return conflicts;
}

async function checkKnownPlates(supabase, knownPlates) {
  const failures = [];

  for (const plate of knownPlates) {
    const normalized = plate.kenteken.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    const headers = { Accept: "application/json" };
    if (process.env.RDW_APP_TOKEN) headers["X-App-Token"] = process.env.RDW_APP_TOKEN;

    const [vehicle] = await (
      await fetch(
        `https://opendata.rdw.nl/resource/m9d7-ebf2.json?kenteken=${normalized}`,
        { headers },
      )
    ).json();

    const fuel = await (
      await fetch(
        `https://opendata.rdw.nl/resource/8ys7-d773.json?kenteken=${normalized}`,
        { headers },
      )
    ).json();

    const snapshot = {
      brand: vehicle.merk?.trim(),
      modelName: vehicle.handelsbenaming?.trim(),
      fuelType: pickFuelType(fuel),
      engineDisplacementCc: vehicle.cilinderinhoud
        ? Number.parseInt(vehicle.cilinderinhoud, 10)
        : null,
      catalogPrice: vehicle.catalogusprijs
        ? Number.parseInt(vehicle.catalogusprijs, 10)
        : null,
      powerKw: pickPowerKw(fuel),
      co2EmissionGKm: pickCo2EmissionGKm(fuel),
      curbWeightKg: vehicle.massa_rijklaar
        ? Number.parseInt(vehicle.massa_rijklaar, 10)
        : null,
      firstRegistrationYear: vehicle.datum_eerste_toelating
        ? Number.parseInt(vehicle.datum_eerste_toelating.slice(0, 4), 10)
        : null,
    };

    const { data: configs } = await supabase
      .from("vehicle_configurations")
      .select("id, brand, model_name, trim_name, catalog_key")
      .ilike("brand", snapshot.brand)
      .not("catalog_key", "like", "rdw:%");

    const modelMatches = filterModelMatches(snapshot, configs);
    const ids = modelMatches.map((r) => r.id);
    const { data: specRows } = await supabase
      .from("vehicle_configuration_specification_values")
      .select("vehicle_configuration_id, spec_key, value_text, value_numeric, value_boolean")
      .in("vehicle_configuration_id", ids);

    const resolvedId = resolveConfigurationId(snapshot, modelMatches, specRows ?? []);
    const resolvedConfig = modelMatches.find((row) => row.id === resolvedId) ?? null;
    const resolvedTrim = resolvedConfig
      ? trimSlugFromCatalogKey(resolvedConfig.catalog_key)
      : null;
    const resolvedEngine = resolvedConfig
      ? engineSlugFromCatalogKey(resolvedConfig.catalog_key)
      : null;

    const equipment = new Map();
    for (const specKey of plate.mustHaveEquipment ?? []) {
      const hit = (specRows ?? []).find(
        (row) =>
          row.vehicle_configuration_id === resolvedId &&
          row.spec_key === specKey &&
          row.value_boolean === true,
      );
      equipment.set(specKey, Boolean(hit));
    }

    const trimOk = !plate.expectTrimSlug || resolvedTrim === plate.expectTrimSlug;
    const engineOk = !plate.expectEngineSlug || resolvedEngine === plate.expectEngineSlug;
    const catalogKeyOk =
      !plate.expectCatalogKey || resolvedConfig?.catalog_key === plate.expectCatalogKey;
    const equipmentOk = [...equipment.values()].every(Boolean);

    if (!trimOk || !engineOk || !catalogKeyOk || !equipmentOk) {
      failures.push({
        kenteken: plate.kenteken,
        label: plate.label,
        resolvedCatalogKey: resolvedConfig?.catalog_key ?? null,
        resolvedTrim,
        expectTrim: plate.expectTrimSlug,
        resolvedEngine,
        expectEngine: plate.expectEngineSlug,
        equipment: Object.fromEntries(equipment),
      });
      logger.error(
        `Known plate failed: ${plate.kenteken} (${plate.label}) catalog=${resolvedConfig?.catalog_key ?? "none"} equipment=${JSON.stringify(Object.fromEntries(equipment))}`,
      );
    } else {
      logger.info(
        `Known plate OK: ${plate.kenteken} catalog=${resolvedConfig?.catalog_key}`,
      );
    }
  }

  return failures;
}

async function main() {
  const supabase = createCatalogClient();
  await loadSpecCatalog(supabase);

  const known = JSON.parse(await readFile(KNOWN_PLATES_PATH, "utf8"));
  const knownPlates = known.plates ?? [];

  logger.info("Verification: catalog depth");
  const depth = await checkCatalogDepth(supabase);

  logger.info("Verification: source conflicts");
  const conflicts = await checkSourceConflicts(supabase);

  logger.info(`Verification: ${knownPlates.length} known plates`);
  const plateFailures = await checkKnownPlates(supabase, knownPlates);

  console.log("");
  console.log("=".repeat(72));
  console.log("CATALOG QUALITY REPORT");
  console.log("=".repeat(72));
  console.log(`Configurations: ${depth.total} total, ${depth.thin} below ${MIN_SPECS_PER_CONFIG} specs`);
  console.log(`Source conflicts (brochure vs listing): ${conflicts}`);
  console.log(`Known plate regressions: ${plateFailures.length}/${knownPlates.length} failed`);
  if (plateFailures.length > 0) {
    for (const failure of plateFailures) {
      console.log(
        `  FAIL ${failure.kenteken}: expected catalog=${failure.expectTrim ? `${failure.expectTrim}/${failure.expectEngine ?? "?"}` : "?"} got ${failure.resolvedCatalogKey}, equipment=${JSON.stringify(failure.equipment)}`,
      );
    }
  }
  console.log("=".repeat(72));

  if (depth.thin > 0 || conflicts > 0 || plateFailures.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
