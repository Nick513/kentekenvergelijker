// Shared scrape orchestration used by scrape-manufacturer.mjs (single run) and
// scrape-batch.mjs (many brand/model targets).
//
// Source priority (brochure-first):
//   1. Brand-specific brochure adapter when registered (e.g. Hyundai)
//   2. Generic manufacturer brochure discovery + PDF parse (all registry brands)
//   3. Plan B listing sites (opt-in via --plan-b; gap-fill only)

import { loadMapping } from "./field-map.mjs";
import { mergeConfigurations, propagatePetrolEquipmentToHybridVariants } from "./merge.mjs";
import { upsertSpecValues, upsertVehicleConfiguration } from "./db-writer.mjs";
import { getManufacturerEntry } from "./manufacturer-registry.mjs";
import {
  createPipelineLogger,
  createScrapeReport,
  EVENT_CODES,
} from "./scrape-report.mjs";
import * as hyundai from "./sources/hyundai.mjs";
import * as brochure from "./sources/brochure.mjs";
import * as gaspedaal from "./sources/gaspedaal.mjs";
import * as autotrack from "./sources/autotrack.mjs";
import * as autoscout24 from "./sources/autoscout24.mjs";

const BRAND_ADAPTERS = {
  hyundai,
};

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

async function writeConfiguration(supabase, config, logger) {
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

  logger?.info?.(
    `DB upsert OK: ${written} spec values`,
    EVENT_CODES.DB_UPSERT_OK,
    { catalogKey: config.catalogKey, specsWritten: written },
  );

  return written;
}

async function scrapeBrandAdapter(brand, ctx) {
  const adapter = BRAND_ADAPTERS[brand.toLowerCase()];
  if (!adapter) {
    ctx.logger.info(
      `No brand-specific adapter for ${brand}`,
      EVENT_CODES.ADAPTER_NONE,
      { brand },
    );
    return { configurations: [], diagnostics: { adapter: null } };
  }

  ctx.logger.info(
    `Running brand adapter for ${brand}`,
    EVENT_CODES.ADAPTER_START,
    { brand, adapter: brand.toLowerCase() },
  );

  try {
    const mapping = await loadMapping(adapter.meta.mappingName);
    const configurations = await adapter.scrape({ ...ctx, mapping });
    ctx.logger.info(
      `Brand adapter returned ${configurations.length} configurations`,
      EVENT_CODES.ADAPTER_COMPLETE,
      { brand, configurationCount: configurations.length },
    );
    return {
      configurations,
      diagnostics: { adapter: brand.toLowerCase(), configurationCount: configurations.length },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    ctx.logger.error(
      `Brand adapter failed: ${message}`,
      EVENT_CODES.ADAPTER_ERROR,
      { brand, adapter: brand.toLowerCase() },
    );
    return { configurations: [], diagnostics: { adapter: brand.toLowerCase(), error: message } };
  }
}

async function scrapeGenericBrochure(brand, ctx) {
  const entry = await getManufacturerEntry(brand);
  if (!entry) {
    ctx.logger.warn(
      `${brand} is not in brand registry; generic brochure skipped`,
      EVENT_CODES.BRAND_NOT_IN_REGISTRY,
      { brand },
    );
    return { configurations: [], diagnostics: { inRegistry: false } };
  }

  const result = await brochure.scrape({
    brand: entry.canonical,
    model: ctx.model,
    generation: ctx.generation,
    specCatalog: ctx.specCatalog,
    logger: ctx.logger,
  });

  ctx.logger.info(
    `Generic brochure returned ${result.configurations.length} configurations`,
    EVENT_CODES.BROCHURE_PARSE_COMPLETE,
    {
      brand: entry.canonical,
      configurationCount: result.configurations.length,
      documentsFound: result.diagnostics.documentsFound,
    },
  );

  return result;
}

/**
 * Run one brand/model/generation scrape and (unless dryRun) write to the DB.
 *
 * @param {{
 *   brand: string, model: string, generation: string,
 *   planBEnabled?: boolean, planBSources?: string[], dryRun?: boolean,
 *   minSpecs?: number,
 *   supabase: import("@supabase/supabase-js").SupabaseClient,
 *   specCatalog: Map,
 *   logger?: object,
 *   report?: ReturnType<typeof createScrapeReport>
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
    minSpecs = 8,
    supabase,
    specCatalog,
    logger: externalLogger,
    report: externalReport,
  } = params;

  const report =
    externalReport ??
    createScrapeReport({ scope: "target", brand, model, generation, minSpecs });
  const logger = externalLogger ?? createPipelineLogger(report);

  logger.info(
    `Scrape ${brand} ${model} (${generation})` +
      `${planBEnabled ? " +plan-b" : " [brochure-only]"}` +
      `${dryRun ? " [dry-run]" : ""}`,
    EVENT_CODES.TARGET_START,
    { brand, model, generation, planBEnabled, dryRun },
  );

  const scrapeCtx = { brand, model, generation, specCatalog, logger, report };

  const adapterResult = await scrapeBrandAdapter(brand, scrapeCtx);
  const brochureResult = await scrapeGenericBrochure(brand, scrapeCtx);

  const brochureMerged = mergeConfigurations(
    adapterResult.configurations,
    brochureResult.configurations,
    { logger, phase: "adapter+brochure" },
  );

  const planBDiagnostics = [];
  let planB = [];

  if (planBEnabled) {
    for (const name of planBSources) {
      const source = PLAN_B_SOURCES[name];
      if (!source) {
        logger.warn(`Unknown Plan B source ignored: ${name}`, null, { source: name });
        continue;
      }

      logger.info(`Plan B source start: ${name}`, EVENT_CODES.PLAN_B_START, { source: name });

      try {
        const configs = await source.scrape({
          brand,
          model,
          generation,
          specCatalog,
          logger,
        });
        logger.info(
          `Plan B [${name}] returned ${configs.length} configurations`,
          EVENT_CODES.PLAN_B_COMPLETE,
          { source: name, configurationCount: configs.length },
        );
        planB.push(...configs);
        planBDiagnostics.push({ source: name, configurationCount: configs.length, status: "ok" });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error(`Plan B [${name}] failed: ${message}`, EVENT_CODES.PLAN_B_ERROR, {
          source: name,
        });
        planBDiagnostics.push({ source: name, status: "error", error: message });
      }
    }
  } else if (brochureMerged.configurations.length === 0) {
    logger.warn(
      `No brochure configurations; enable --plan-b for listing gap-fill`,
      EVENT_CODES.PLAN_B_DISABLED,
      { brand, model, generation },
    );
  }

  const finalMerge = mergeConfigurations(brochureMerged.configurations, planB, {
    logger,
    phase: "plan-b-gap-fill",
  });

  const equipmentSpecKeys = [...specCatalog.entries()]
    .filter(([, meta]) => meta.valueSource === "equipment")
    .map(([specKey]) => specKey);
  const configurations = propagatePetrolEquipmentToHybridVariants(
    finalMerge.configurations,
    equipmentSpecKeys,
  );

  const totalSpecsAcrossConfigurations = configurations.reduce(
    (sum, config) => sum + config.specs.length,
    0,
  );
  const averageSpecsPerConfiguration =
    configurations.length > 0
      ? totalSpecsAcrossConfigurations / configurations.length
      : 0;

  logger.info(
    `Merged into ${configurations.length} configurations (invalid=${finalMerge.skipped.length} duplicates=${finalMerge.duplicates.length} gapFills=${finalMerge.gapFills})`,
    EVENT_CODES.TARGET_COMPLETE,
    {
      mergedConfigurations: configurations.length,
      invalidSkipped: finalMerge.skipped.length,
      duplicates: finalMerge.duplicates.length,
      gapFills: finalMerge.gapFills,
      averageSpecsPerConfiguration: Number.parseFloat(averageSpecsPerConfiguration.toFixed(1)),
    },
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
      insufficientSpecs: config.specs.length < minSpecs,
    };

    if (dryRun) {
      perConfig.push(record);
      logger.info(`[dry-run] ${config.catalogKey} :: ${config.specs.length} specs`);
      continue;
    }

    try {
      const written = await writeConfiguration(supabase, config, logger);
      totalSpecsWritten += written;
      perConfig.push({ ...record, specsWritten: written });
      logger.info(`${config.catalogKey} :: wrote ${written} spec values`);
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      logger.error(
        `${config.catalogKey} :: write failed (${message})`,
        EVENT_CODES.DB_UPSERT_FAILED,
        { catalogKey: config.catalogKey },
      );
    }
  }

  const counts = {
    adapterConfigurations: adapterResult.configurations.length,
    brochureConfigurations: brochureResult.configurations.length,
    planBConfigurations: planB.length,
    mergedConfigurations: configurations.length,
    invalidSkipped: finalMerge.skipped.length,
    duplicates: finalMerge.duplicates.length,
    gapFills: finalMerge.gapFills,
    skipped: finalMerge.skipped.length,
    failed,
    totalSpecsWritten,
    totalSpecsAcrossConfigurations,
    averageSpecsPerConfiguration: Number.parseFloat(averageSpecsPerConfiguration.toFixed(1)),
  };

  const { outcome, reasons } = report.summarizeOutcome(counts);

  const summary = {
    brand,
    model,
    generation,
    planBEnabled,
    dryRun,
    outcome,
    outcomeReasons: reasons,
    issueCount: report.events.filter((event) => event.level === "warn" || event.level === "error")
      .length,
    averageSpecsPerConfiguration: counts.averageSpecsPerConfiguration,
    counts,
    diagnostics: {
      adapter: adapterResult.diagnostics,
      brochure: brochureResult.diagnostics,
      planB: planBDiagnostics,
      merge: {
        adapterBrochureDuplicates: brochureMerged.duplicates,
        invalidSkipped: finalMerge.skipped,
        duplicates: finalMerge.duplicates,
        gapFills: finalMerge.gapFills,
      },
    },
    configurations: perConfig,
    report: report.toJSON({ outcome, outcomeReasons: reasons, counts }),
  };

  return summary;
}
