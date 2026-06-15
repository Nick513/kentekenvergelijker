// Batch catalog scraper. Runs the scrape pipeline across a list of brand/model
// targets (default: scripts/lib/scraper/targets.json) using Plan B for any
// brand and manufacturer brochures where an adapter exists.
//
// Usage:
//   node --env-file=.env.local scripts/scrape-batch.mjs [--file path] [--dry-run] [--no-plan-b]

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { loadSpecCatalog } from "./lib/scraper/field-map.mjs";
import { createCatalogClient } from "./lib/scraper/db-writer.mjs";
import { logger } from "./lib/scraper/logger.mjs";
import { writeRunLog } from "./lib/scraper/run-log.mjs";
import { DEFAULT_PLAN_B_ORDER, runScrape } from "./lib/scraper/run.mjs";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_TARGETS = path.join(moduleDir, "lib", "scraper", "targets.json");

function parseCliArgs() {
  const { values } = parseArgs({
    options: {
      file: { type: "string", default: DEFAULT_TARGETS },
      "dry-run": { type: "boolean", default: false },
      "no-plan-b": { type: "boolean", default: false },
      "plan-b-sources": { type: "string", default: DEFAULT_PLAN_B_ORDER.join(",") },
    },
  });
  return values;
}

async function main() {
  const args = parseCliArgs();
  const parsed = JSON.parse(await readFile(args.file, "utf8"));
  const targets = parsed.targets ?? [];

  if (targets.length === 0) {
    logger.warn(`No targets found in ${args.file}`);
    return;
  }

  const planBEnabled = !args["no-plan-b"];
  const planBSources = args["plan-b-sources"]
    .split(",")
    .map((name) => name.trim().toLowerCase())
    .filter(Boolean);

  const supabase = createCatalogClient();
  const specCatalog = await loadSpecCatalog(supabase);
  logger.info(`Loaded ${specCatalog.size} specification keys`);
  logger.info(`Batch: ${targets.length} targets`);

  const runs = [];
  let totalConfigurations = 0;
  let totalSpecsWritten = 0;

  for (const target of targets) {
    if (!target.brand || !target.model || !target.generation) {
      logger.warn(`Skipping invalid target: ${JSON.stringify(target)}`);
      continue;
    }

    try {
      const summary = await runScrape({
        brand: target.brand,
        model: target.model,
        generation: target.generation,
        planBEnabled,
        planBSources,
        dryRun: args["dry-run"],
        supabase,
        specCatalog,
        logger,
      });
      runs.push(summary);
      totalConfigurations += summary.counts.mergedConfigurations;
      totalSpecsWritten += summary.counts.totalSpecsWritten;
    } catch (error) {
      logger.error(
        `${target.brand} ${target.model}: run failed (${error instanceof Error ? error.message : error})`,
      );
      runs.push({
        brand: target.brand,
        model: target.model,
        generation: target.generation,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const logPath = await writeRunLog({
    batch: true,
    dryRun: args["dry-run"],
    planBEnabled,
    targetCount: targets.length,
    totals: { totalConfigurations, totalSpecsWritten },
    runs,
  });

  logger.info(`Run log: ${logPath}`);
  logger.info(
    `Batch done. targets=${targets.length} configurations=${totalConfigurations} specsWritten=${totalSpecsWritten}`,
  );
}

main().catch((error) => {
  logger.error("Batch scrape failed.");
  logger.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
