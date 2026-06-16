// Catalog scraper CLI for a single brand/model/generation.
// Brochure-first for all registry brands (generic discovery + brand adapters),
// optional Plan B trim discovery + gap-fill, then idempotent catalog upserts.

import { parseArgs } from "node:util";
import { loadSpecCatalog } from "./lib/scraper/field-map.mjs";
import { createCatalogClient } from "./lib/scraper/db-writer.mjs";
import { writeRunLog } from "./lib/scraper/run-log.mjs";
import { DEFAULT_PLAN_B_ORDER, runScrape } from "./lib/scraper/run.mjs";
import {
  aggregateBatchIssues,
  formatBatchReport,
} from "./lib/scraper/scrape-report.mjs";

function parseCliArgs() {
  const { values } = parseArgs({
    options: {
      brand: { type: "string", default: "Hyundai" },
      model: { type: "string", default: "i20" },
      generation: { type: "string", default: "2020-plus" },
      "plan-b": { type: "boolean", default: false },
      "plan-b-sources": { type: "string", default: DEFAULT_PLAN_B_ORDER.join(",") },
      "dry-run": { type: "boolean", default: false },
      "skip-min-specs": { type: "string", default: "8" },
    },
  });
  return values;
}

async function main() {
  const args = parseCliArgs();
  const supabase = createCatalogClient();
  const specCatalog = await loadSpecCatalog(supabase);
  const skipMinSpecs = Number.parseFloat(args["skip-min-specs"]);

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
    minSpecs: skipMinSpecs,
    supabase,
    specCatalog,
  });

  const { issuesByCode, summary: outcomeSummary } = aggregateBatchIssues([summary]);
  const logPath = await writeRunLog({
    ...summary,
    batch: false,
    issuesByCode,
    summary: outcomeSummary,
  });

  console.log(
    formatBatchReport({
      dryRun: args["dry-run"],
      planBEnabled: args["plan-b"],
      totals: {
        targetCount: 1,
        ran: 1,
        skippedTargets: 0,
        failedTargets: summary.outcome === "error" ? 1 : 0,
        totalConfigurations: summary.counts.mergedConfigurations,
        totalSpecsWritten: summary.counts.totalSpecsWritten,
      },
      summary: outcomeSummary,
      issuesByCode,
      runs: [summary],
      logPath,
    }),
  );
}

main().catch((error) => {
  console.error(`[${new Date().toISOString()}] ERROR Scrape failed.`);
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
