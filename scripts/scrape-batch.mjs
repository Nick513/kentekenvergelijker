// Batch catalog scraper. Runs the brochure-first pipeline across brand/model
// targets (default: scripts/lib/scraper/targets.json).
//
// Default behavior is brochure-only for all brands in brand-registry.json.
// Plan B listing sources are disabled unless explicitly enabled with --plan-b.
//
// Usage:
//   node --env-file=.env.local scripts/scrape-batch.mjs [--file path] [--dry-run] [--plan-b]

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { loadSpecCatalog } from "./lib/scraper/field-map.mjs";
import { createCatalogClient } from "./lib/scraper/db-writer.mjs";
import { writeRunLog } from "./lib/scraper/run-log.mjs";
import { DEFAULT_PLAN_B_ORDER, runScrape } from "./lib/scraper/run.mjs";
import { slugify } from "./lib/scraper/catalog-key.mjs";
import {
  aggregateBatchIssues,
  createPipelineLogger,
  createScrapeReport,
  EVENT_CODES,
  formatBatchReport,
} from "./lib/scraper/scrape-report.mjs";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_TARGETS = path.join(moduleDir, "lib", "scraper", "targets.json");

function parseCliArgs() {
  const { values } = parseArgs({
    options: {
      file: { type: "string", default: DEFAULT_TARGETS },
      "dry-run": { type: "boolean", default: false },
      "plan-b": { type: "boolean", default: false },
      "no-plan-b": { type: "boolean", default: false },
      "plan-b-sources": { type: "string", default: DEFAULT_PLAN_B_ORDER.join(",") },
      "only-missing": { type: "boolean", default: false },
      "refresh-older-than-days": { type: "string", default: "7" },
      "skip-min-specs": { type: "string", default: "8" },
      force: { type: "boolean", default: false },
    },
  });
  return values;
}

async function loadExistingCoverage(supabase, target) {
  const generationSlug = slugify(target.generation);

  const { data: configurations, error: configError } = await supabase
    .from("vehicle_configurations")
    .select("id, catalog_key")
    .ilike("brand", target.brand)
    .ilike("model_name", target.model)
    .like("catalog_key", `%|${generationSlug}|%`)
    .not("catalog_key", "like", "rdw:%");

  if (configError) {
    throw new Error(
      `Failed to load existing coverage for ${target.brand} ${target.model}: ${configError.message}`,
    );
  }

  const configIds = (configurations ?? []).map((row) => row.id);
  if (configIds.length === 0) {
    return {
      configurationCount: 0,
      averageSpecsPerConfiguration: 0,
      latestFetchedAt: null,
      shouldSkip: false,
    };
  }

  const { data: specRows, error: specError } = await supabase
    .from("vehicle_configuration_specification_values")
    .select("vehicle_configuration_id, fetched_at")
    .in("vehicle_configuration_id", configIds);

  if (specError) {
    throw new Error(
      `Failed to load existing spec coverage for ${target.brand} ${target.model}: ${specError.message}`,
    );
  }

  const countByConfig = new Map();
  let latestFetchedAt = null;

  for (const row of specRows ?? []) {
    countByConfig.set(
      row.vehicle_configuration_id,
      (countByConfig.get(row.vehicle_configuration_id) ?? 0) + 1,
    );
    const fetchedAt = row.fetched_at ? new Date(row.fetched_at) : null;
    if (fetchedAt && !Number.isNaN(fetchedAt.getTime())) {
      if (!latestFetchedAt || fetchedAt > latestFetchedAt) {
        latestFetchedAt = fetchedAt;
      }
    }
  }

  const specCounts = configIds.map((id) => countByConfig.get(id) ?? 0);
  const averageSpecsPerConfiguration =
    specCounts.reduce((sum, count) => sum + count, 0) / specCounts.length;

  return {
    configurationCount: configIds.length,
    averageSpecsPerConfiguration,
    latestFetchedAt,
    shouldSkip: false,
  };
}

async function main() {
  const args = parseCliArgs();
  const parsed = JSON.parse(await readFile(args.file, "utf8"));
  const targets = parsed.targets ?? [];

  const batchReport = createScrapeReport({ scope: "batch" });
  const logger = createPipelineLogger(batchReport);

  if (targets.length === 0) {
    logger.warn(`No targets found in ${args.file}`);
    return;
  }

  const planBEnabled = args["plan-b"] && !args["no-plan-b"];
  const planBSources = args["plan-b-sources"]
    .split(",")
    .map((name) => name.trim().toLowerCase())
    .filter(Boolean);
  const onlyMissing = args["only-missing"];
  const force = args.force;
  const refreshOlderThanDays = Number.parseInt(args["refresh-older-than-days"], 10);
  const skipMinSpecs = Number.parseFloat(args["skip-min-specs"]);

  const supabase = createCatalogClient();
  const specCatalog = await loadSpecCatalog(supabase);

  logger.info(
    `Batch start: ${targets.length} targets from ${args.file}`,
    EVENT_CODES.BATCH_START,
    {
      targetCount: targets.length,
      targetsFile: args.file,
      planBEnabled,
      planBSources,
      onlyMissing,
      skipMinSpecs,
      refreshOlderThanDays,
      dryRun: args["dry-run"],
      force,
      specCatalogSize: specCatalog.size,
    },
  );

  const runs = [];
  let totalConfigurations = 0;
  let totalSpecsWritten = 0;
  let skippedTargets = 0;
  let ranTargets = 0;
  let failedTargets = 0;

  for (const target of targets) {
    if (!target.brand || !target.model || !target.generation) {
      logger.warn(`Skipping invalid target: ${JSON.stringify(target)}`, null, { target });
      continue;
    }

    try {
      if (onlyMissing && !force) {
        const existing = await loadExistingCoverage(supabase, target);
        const cutoff = Number.isFinite(refreshOlderThanDays)
          ? Date.now() - refreshOlderThanDays * 24 * 60 * 60 * 1000
          : null;
        const isFresh =
          existing.latestFetchedAt instanceof Date &&
          cutoff !== null &&
          existing.latestFetchedAt.getTime() >= cutoff;
        const hasEnoughSpecs =
          Number.isFinite(skipMinSpecs) &&
          existing.averageSpecsPerConfiguration >= skipMinSpecs;
        const hasConfigurations = existing.configurationCount > 0;

        if (hasConfigurations && hasEnoughSpecs && isFresh) {
          skippedTargets += 1;
          logger.info(
            `Skip ${target.brand} ${target.model} (${target.generation}): fresh and covered`,
            EVENT_CODES.TARGET_SKIP,
            {
              brand: target.brand,
              model: target.model,
              generation: target.generation,
              reason: "fresh-and-covered",
              configurationCount: existing.configurationCount,
              averageSpecsPerConfiguration: Number.parseFloat(
                existing.averageSpecsPerConfiguration.toFixed(1),
              ),
              latestFetchedAt: existing.latestFetchedAt?.toISOString() ?? null,
            },
          );
          runs.push({
            brand: target.brand,
            model: target.model,
            generation: target.generation,
            skipped: true,
            outcome: "skipped",
            reason: "fresh-and-covered",
            existingCoverage: {
              configurationCount: existing.configurationCount,
              averageSpecsPerConfiguration: Number.parseFloat(
                existing.averageSpecsPerConfiguration.toFixed(1),
              ),
              latestFetchedAt: existing.latestFetchedAt?.toISOString() ?? null,
            },
            counts: {
              adapterConfigurations: 0,
              brochureConfigurations: 0,
              planBConfigurations: 0,
              mergedConfigurations: 0,
              skipped: 0,
              failed: 0,
              totalSpecsWritten: 0,
            },
            configurations: [],
          });
          continue;
        }
      }

      ranTargets += 1;
      const summary = await runScrape({
        brand: target.brand,
        model: target.model,
        generation: target.generation,
        planBEnabled,
        planBSources,
        dryRun: args["dry-run"],
        minSpecs: skipMinSpecs,
        supabase,
        specCatalog,
      });
      runs.push(summary);
      totalConfigurations += summary.counts.mergedConfigurations;
      totalSpecsWritten += summary.counts.totalSpecsWritten;
      if (summary.outcome === "error") {
        failedTargets += 1;
      }
    } catch (error) {
      failedTargets += 1;
      const message = error instanceof Error ? error.message : String(error);
      logger.error(
        `${target.brand} ${target.model}: run failed (${message})`,
        EVENT_CODES.TARGET_ERROR,
        { brand: target.brand, model: target.model, generation: target.generation },
      );
      runs.push({
        brand: target.brand,
        model: target.model,
        generation: target.generation,
        outcome: "error",
        error: message,
      });
    }
  }

  const { issuesByCode, summary: outcomeSummary } = aggregateBatchIssues(runs);

  const batchLog = {
    batch: true,
    dryRun: args["dry-run"],
    planBEnabled,
    planBSources,
    onlyMissing,
    skipMinSpecs,
    refreshOlderThanDays,
    force,
    targetCount: targets.length,
    totals: {
      targetCount: targets.length,
      ran: ranTargets,
      skippedTargets,
      failedTargets,
      totalConfigurations,
      totalSpecsWritten,
    },
    summary: outcomeSummary,
    issuesByCode,
    batchReport: batchReport.toJSON(),
    runs,
  };

  const logPath = await writeRunLog(batchLog);
  batchLog.logPath = logPath;

  console.log(formatBatchReport(batchLog));

  logger.info(
    `Batch complete`,
    EVENT_CODES.BATCH_COMPLETE,
    {
      logPath,
      ...batchLog.totals,
      summary: outcomeSummary,
    },
  );
}

main().catch((error) => {
  console.error(`[${new Date().toISOString()}] ERROR Batch scrape failed.`);
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
