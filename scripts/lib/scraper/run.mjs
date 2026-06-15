// Shared scrape orchestration used by scrape-manufacturer.mjs (single run) and
// scrape-batch.mjs (many brand/model targets). Manufacturer source is optional:
// brands without a registered brochure adapter still work via Plan B sources.

import { loadMapping } from "./field-map.mjs";
import { mergeConfigurations } from "./merge.mjs";
import { upsertSpecValues, upsertVehicleConfiguration } from "./db-writer.mjs";
import * as hyundai from "./sources/hyundai.mjs";
import * as gaspedaal from "./sources/gaspedaal.mjs";
import * as autotrack from "./sources/autotrack.mjs";
import * as autoscout24 from "./sources/autoscout24.mjs";

// Optional per-brand manufacturer adapters. Add a new entry here when a brand
// has a brochure/price-list parser; all other brands still work via Plan B.
export const MANUFACTURER_SOURCES = {
  hyundai,
};

// Plan B sources in gap-fill priority order: earlier sources win, later ones
// only fill spec_keys still empty (see merge.mjs).
export const PLAN_B_SOURCES = {
  gaspedaal,
  autotrack,
  autoscout24,
};

export const DEFAULT_PLAN_B_ORDER = ["gaspedaal", "autotrack", "autoscout24"];

function groupSpecsBySource(specs) {
  const bySource = new Map();
  for (const spec of specs) {
    const source = spec.source ?? "unknown";
    if (!bySource.has(source)) bySource.set(source, []);
    bySource.get(source).push(spec);
  }
  return bySource;
}

async function writeConfiguration(supabase, config) {
  const vehicleConfigurationId = await upsertVehicleConfiguration(supabase, {
    brand: config.brand,
    modelName: config.modelName,
    trimName: config.trimName,
    catalogKey: config.catalogKey,
  });

  let written = 0;
  for (const [source, specs] of groupSpecsBySource(config.specs)) {
    written += await upsertSpecValues(supabase, vehicleConfigurationId, specs, source);
  }
  return written;
}

/**
 * Run one brand/model/generation scrape and (unless dryRun) write to the DB.
 *
 * @param {{
 *   brand: string, model: string, generation: string,
 *   planBEnabled?: boolean, planBSources?: string[], dryRun?: boolean,
 *   supabase: import("@supabase/supabase-js").SupabaseClient,
 *   specCatalog: Map, logger: { info: Function, warn: Function, error: Function }
 * }} params
 * @returns {Promise<object>} summary
 */
export async function runScrape(params) {
  const {
    brand,
    model,
    generation,
    planBEnabled = false,
    planBSources = DEFAULT_PLAN_B_ORDER,
    dryRun = false,
    supabase,
    specCatalog,
    logger,
  } = params;

  logger.info(
    `Scrape ${brand} ${model} (${generation})` +
      `${planBEnabled ? " +plan-b" : ""}${dryRun ? " [dry-run]" : ""}`,
  );

  let primary = [];
  const manufacturerSource = MANUFACTURER_SOURCES[brand.toLowerCase()];
  if (manufacturerSource) {
    const mapping = await loadMapping(manufacturerSource.meta.mappingName);
    primary = await manufacturerSource.scrape({
      brand,
      model,
      generation,
      mapping,
      specCatalog,
      logger,
    });
    logger.info(`Manufacturer source returned ${primary.length} configurations`);
  } else {
    logger.warn(
      `No manufacturer source for ${brand}; using Plan B only (brochure specs unavailable)`,
    );
  }

  let planB = [];
  if (planBEnabled) {
    for (const name of planBSources) {
      const source = PLAN_B_SOURCES[name];
      if (!source) {
        logger.warn(`Unknown Plan B source ignored: ${name}`);
        continue;
      }
      const configs = await source.scrape({
        brand,
        model,
        generation,
        specCatalog,
        logger,
      });
      logger.info(`Plan B [${name}] returned ${configs.length} configurations`);
      planB.push(...configs);
    }
  }

  const { configurations, skipped } = mergeConfigurations(primary, planB);
  logger.info(
    `Merged into ${configurations.length} configurations (${skipped.length} skipped)`,
  );

  const perConfig = [];
  let totalSpecsWritten = 0;
  let failed = 0;

  for (const config of configurations) {
    const sources = [...new Set(config.specs.map((spec) => spec.source))];
    const record = {
      catalogKey: config.catalogKey,
      trimName: config.trimName,
      engineName: config.engineName,
      specCount: config.specs.length,
      sources,
    };

    if (dryRun) {
      perConfig.push(record);
      logger.info(`[dry-run] ${config.catalogKey} :: ${config.specs.length} specs`);
      continue;
    }

    try {
      const written = await writeConfiguration(supabase, config);
      totalSpecsWritten += written;
      perConfig.push({ ...record, specsWritten: written });
      logger.info(`${config.catalogKey} :: wrote ${written} spec values`);
    } catch (error) {
      failed += 1;
      logger.error(
        `${config.catalogKey} :: write failed (${error instanceof Error ? error.message : error})`,
      );
    }
  }

  return {
    brand,
    model,
    generation,
    planBEnabled,
    dryRun,
    counts: {
      manufacturerConfigurations: primary.length,
      planBConfigurations: planB.length,
      mergedConfigurations: configurations.length,
      skipped: skipped.length,
      failed,
      totalSpecsWritten,
    },
    configurations: perConfig,
  };
}
