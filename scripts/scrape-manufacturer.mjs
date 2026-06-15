// Catalog scraper CLI for a single brand/model/generation. Manufacturer
// brochure/HTML first (when an adapter exists), optional Plan B trim discovery +
// gap-fill, then idempotent upserts into the catalog tables.
//
// Usage:
//   node --env-file=.env.local scripts/scrape-manufacturer.mjs \
//     --brand Hyundai --model i20 --generation 2020-plus [--plan-b] [--dry-run]

import { parseArgs } from "node:util";
import { loadSpecCatalog } from "./lib/scraper/field-map.mjs";
import { createCatalogClient } from "./lib/scraper/db-writer.mjs";
import { logger } from "./lib/scraper/logger.mjs";
import { writeRunLog } from "./lib/scraper/run-log.mjs";
import { DEFAULT_PLAN_B_ORDER, runScrape } from "./lib/scraper/run.mjs";

function parseCliArgs() {
  const { values } = parseArgs({
    options: {
      brand: { type: "string", default: "Hyundai" },
      model: { type: "string", default: "i20" },
      generation: { type: "string", default: "2020-plus" },
      "plan-b": { type: "boolean", default: false },
      "plan-b-sources": { type: "string", default: DEFAULT_PLAN_B_ORDER.join(",") },
      "dry-run": { type: "boolean", default: false },
    },
  });
  return values;
}

async function main() {
  const args = parseCliArgs();
  const supabase = createCatalogClient();
  const specCatalog = await loadSpecCatalog(supabase);
  logger.info(`Loaded ${specCatalog.size} specification keys`);

  const summary = await runScrape({
    brand: args.brand,
    model: args.model,
    generation: args.generation,
    planBEnabled: args["plan-b"],
    planBSources: args["plan-b-sources"]
      .split(",")
      .map((name) => name.trim().toLowerCase())
      .filter(Boolean),
    dryRun: args["dry-run"],
    supabase,
    specCatalog,
    logger,
  });

  const logPath = await writeRunLog(summary);
  logger.info(`Run log: ${logPath}`);
  logger.info(
    `Done. configurations=${summary.counts.mergedConfigurations} ` +
      `specsWritten=${summary.counts.totalSpecsWritten} ` +
      `skipped=${summary.counts.skipped} failed=${summary.counts.failed}`,
  );
}

main().catch((error) => {
  logger.error("Scrape failed.");
  logger.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
