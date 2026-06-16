// Structured scrape reporting for console output and JSON run logs.
// Every pipeline stage records coded events so batch runs produce a full
// feedback loop (reachability, rate limits, parse failures, thin coverage, etc.).

export const EVENT_CODES = {
  BATCH_START: "batch.start",
  BATCH_COMPLETE: "batch.complete",
  TARGET_START: "target.start",
  TARGET_SKIP: "target.skip",
  TARGET_COMPLETE: "target.complete",
  TARGET_ERROR: "target.error",
  BRAND_NOT_IN_REGISTRY: "brand.not_in_registry",
  BRAND_NO_WEBSITE: "brand.no_website",
  ADAPTER_NONE: "adapter.none",
  ADAPTER_START: "adapter.start",
  ADAPTER_COMPLETE: "adapter.complete",
  ADAPTER_ERROR: "adapter.error",
  BROCHURE_DISCOVERY_START: "brochure.discovery_start",
  BROCHURE_DISCOVERY_COMPLETE: "brochure.discovery_complete",
  BROCHURE_NO_DOCUMENTS: "brochure.no_documents",
  BROCHURE_PARSE_START: "brochure.parse_start",
  BROCHURE_PARSE_COMPLETE: "brochure.parse_complete",
  BROCHURE_PARSE_FAILED: "brochure.parse_failed",
  BROCHURE_DUPLICATE_CONFIG: "brochure.duplicate_config",
  HTTP_FETCH_OK: "http.fetch_ok",
  HTTP_FETCH_FAILED: "http.fetch_failed",
  HTTP_RATE_LIMITED: "http.rate_limited",
  HTTP_IP_BLOCKED: "http.ip_blocked",
  HTTP_SITE_UNREACHABLE: "http.site_unreachable",
  HTTP_NOT_FOUND: "http.not_found",
  HTTP_SERVER_ERROR: "http.server_error",
  PDF_DOWNLOAD_OK: "pdf.download_ok",
  PDF_DOWNLOAD_FAILED: "pdf.download_failed",
  PDF_PARSE_FAILED: "pdf.parse_failed",
  MERGE_DUPLICATE_CATALOG_KEY: "merge.duplicate_catalog_key",
  MERGE_INVALID_CATALOG_KEY: "merge.invalid_catalog_key",
  MERGE_GAP_FILL: "merge.gap_fill",
  PLAN_B_START: "plan_b.start",
  PLAN_B_COMPLETE: "plan_b.complete",
  PLAN_B_DISABLED: "plan_b.disabled",
  PLAN_B_ERROR: "plan_b.error",
  COVERAGE_INSUFFICIENT: "coverage.insufficient",
  DB_UPSERT_OK: "db.upsert_ok",
  DB_UPSERT_FAILED: "db.upsert_failed",
};

const ISSUE_CODES = new Set([
  EVENT_CODES.BRAND_NOT_IN_REGISTRY,
  EVENT_CODES.BRAND_NO_WEBSITE,
  EVENT_CODES.ADAPTER_ERROR,
  EVENT_CODES.BROCHURE_NO_DOCUMENTS,
  EVENT_CODES.BROCHURE_PARSE_FAILED,
  EVENT_CODES.HTTP_FETCH_FAILED,
  EVENT_CODES.HTTP_RATE_LIMITED,
  EVENT_CODES.HTTP_IP_BLOCKED,
  EVENT_CODES.HTTP_SITE_UNREACHABLE,
  EVENT_CODES.HTTP_NOT_FOUND,
  EVENT_CODES.HTTP_SERVER_ERROR,
  EVENT_CODES.PDF_DOWNLOAD_FAILED,
  EVENT_CODES.PDF_PARSE_FAILED,
  EVENT_CODES.MERGE_DUPLICATE_CATALOG_KEY,
  EVENT_CODES.MERGE_INVALID_CATALOG_KEY,
  EVENT_CODES.PLAN_B_ERROR,
  EVENT_CODES.COVERAGE_INSUFFICIENT,
  EVENT_CODES.DB_UPSERT_FAILED,
  EVENT_CODES.TARGET_ERROR,
]);

/**
 * Classify fetch/network errors into actionable scrape report codes.
 *
 * @param {unknown} error
 * @param {{ status?: number, url?: string }} [context]
 */
export function classifyFetchError(error, context = {}) {
  const message = error instanceof Error ? error.message : String(error);
  const status = context.status ?? extractHttpStatus(message);
  const lower = message.toLowerCase();

  if (status === 429) {
    return { code: EVENT_CODES.HTTP_RATE_LIMITED, category: "rate_limited", message };
  }
  if (status === 403) {
    return { code: EVENT_CODES.HTTP_IP_BLOCKED, category: "ip_blocked", message };
  }
  if (status === 404) {
    return { code: EVENT_CODES.HTTP_NOT_FOUND, category: "not_found", message };
  }
  if (status !== undefined && status >= 500) {
    return { code: EVENT_CODES.HTTP_SERVER_ERROR, category: "server_error", message };
  }
  if (
    /enotfound|econnrefused|econnreset|etimedout|network|fetch failed|socket/i.test(
      lower,
    )
  ) {
    return { code: EVENT_CODES.HTTP_SITE_UNREACHABLE, category: "site_unreachable", message };
  }
  if (/captcha|cloudflare|blocked|denied|bot detection/i.test(lower)) {
    return { code: EVENT_CODES.HTTP_IP_BLOCKED, category: "ip_blocked", message };
  }

  return { code: EVENT_CODES.HTTP_FETCH_FAILED, category: "fetch_failed", message };
}

function extractHttpStatus(message) {
  const match = String(message).match(/HTTP\s+(\d{3})/i);
  return match ? Number.parseInt(match[1], 10) : undefined;
}

/**
 * @param {{ scope?: string, brand?: string, model?: string, generation?: string, minSpecs?: number }} [meta]
 */
export function createScrapeReport(meta = {}) {
  const startedAt = new Date().toISOString();
  const events = [];
  const counters = {};

  function bump(key, amount = 1) {
    counters[key] = (counters[key] ?? 0) + amount;
  }

  function record(level, code, message, context = {}) {
    const event = {
      at: new Date().toISOString(),
      level,
      code,
      message,
      ...context,
    };
    events.push(event);
    if (ISSUE_CODES.has(code)) {
      bump("issues");
      bump(`issue:${code}`);
    }
    return event;
  }

  function child(scopeMeta) {
    return createScrapeReport({ ...meta, ...scopeMeta });
  }

  function summarizeOutcome(counts = {}) {
    const merged = counts.mergedConfigurations ?? 0;
    const avgSpecs =
      counts.averageSpecsPerConfiguration ??
      (merged > 0 && counts.totalSpecsAcrossConfigurations
        ? counts.totalSpecsAcrossConfigurations / merged
        : 0);

    let outcome = "success";
    const reasons = [];

    if (counts.failed > 0) {
      outcome = "error";
      reasons.push("db_write_failures");
    } else if (merged === 0) {
      outcome = "no_data";
      reasons.push("no_configurations");
    } else if (meta.minSpecs && avgSpecs < meta.minSpecs) {
      outcome = "insufficient";
      reasons.push("low_spec_coverage");
      record(
        "warn",
        EVENT_CODES.COVERAGE_INSUFFICIENT,
        `Average ${avgSpecs.toFixed(1)} specs/config below threshold ${meta.minSpecs}`,
        { averageSpecsPerConfiguration: Number.parseFloat(avgSpecs.toFixed(1)), threshold: meta.minSpecs },
      );
    }

    return { outcome, reasons, averageSpecsPerConfiguration: Number.parseFloat(avgSpecs.toFixed(1)) };
  }

  function toJSON(extra = {}) {
    const issueEvents = events.filter((event) => ISSUE_CODES.has(event.code));
    const issuesByCode = {};
    for (const event of issueEvents) {
      if (!issuesByCode[event.code]) issuesByCode[event.code] = [];
      issuesByCode[event.code].push({
        message: event.message,
        url: event.url,
        brand: event.brand ?? meta.brand,
        model: event.model ?? meta.model,
        generation: event.generation ?? meta.generation,
        source: event.source,
        catalogKey: event.catalogKey,
      });
    }

    return {
      scope: meta.scope ?? "run",
      brand: meta.brand ?? null,
      model: meta.model ?? null,
      generation: meta.generation ?? null,
      startedAt,
      finishedAt: new Date().toISOString(),
      counters,
      events,
      issuesByCode,
      ...extra,
    };
  }

  return {
    meta,
    events,
    counters,
    record,
    bump,
    child,
    summarizeOutcome,
    toJSON,
  };
}

/**
 * Logger that mirrors messages to console and records structured events.
 *
 * @param {ReturnType<typeof createScrapeReport>} report
 */
export function createPipelineLogger(report) {
  function stamp(level) {
    return `[${new Date().toISOString()}] ${level}`;
  }

  function log(level, code, message, context) {
    const prefix = `${stamp(level)}`;
    const line = context?.url ? `${message} | ${context.url}` : message;
    if (level === "ERROR") {
      console.error(`${prefix} ${line}`);
    } else if (level === "WARN") {
      console.warn(`${prefix} ${line}`);
    } else {
      console.log(`${prefix} ${line}`);
    }
    if (code) {
      record(level, code, message, context);
    }
  }

  function record(level, code, message, context = {}) {
    report.record(level.toLowerCase(), code, message, context);
  }

  function recordFetchError(error, context = {}) {
    const classified = classifyFetchError(error, context);
    const level =
      classified.code === EVENT_CODES.HTTP_RATE_LIMITED ||
      classified.code === EVENT_CODES.HTTP_IP_BLOCKED
        ? "ERROR"
        : "WARN";
    log(level, classified.code, classified.message, {
      ...context,
      category: classified.category,
      status: context.status ?? extractHttpStatus(classified.message),
    });
    return classified;
  }

  return {
    info(message, code = null, context) {
      log("INFO", code, message, context);
    },
    warn(message, code = null, context) {
      log("WARN", code, message, context);
    },
    error(message, code = null, context) {
      log("ERROR", code, message, context);
    },
    record,
    recordFetchError,
    report,
  };
}

function dedupeIssues(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = `${item.brand ?? ""}|${item.model ?? ""}|${item.message}|${item.url ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * @param {object} batchLog
 */
export function formatBatchReport(batchLog) {
  const lines = [];
  const totals = batchLog.totals ?? {};
  const summary = batchLog.summary ?? {};

  lines.push("");
  lines.push("=".repeat(72));
  lines.push("BATCH SCRAPE REPORT");
  lines.push("=".repeat(72));
  lines.push(
    `Targets: ${totals.targetCount ?? 0} | Ran: ${totals.ran ?? 0} | Skipped (fresh): ${totals.skippedTargets ?? 0} | Failed: ${totals.failedTargets ?? 0}`,
  );
  lines.push(
    `Configurations: ${totals.totalConfigurations ?? 0} | Specs written: ${totals.totalSpecsWritten ?? 0} | Dry-run: ${batchLog.dryRun ? "yes" : "no"} | Plan B: ${batchLog.planBEnabled ? "yes" : "no"}`,
  );
  lines.push(
    `Outcomes: success=${summary.success ?? 0} insufficient=${summary.insufficient ?? 0} no_data=${summary.no_data ?? 0} error=${summary.error ?? 0} skipped=${summary.skipped ?? 0}`,
  );

  const issuesByCode = batchLog.issuesByCode ?? {};
  const codes = Object.keys(issuesByCode).sort(
    (a, b) => (issuesByCode[b]?.length ?? 0) - (issuesByCode[a]?.length ?? 0),
  );

  if (codes.length > 0) {
    lines.push("");
    lines.push("ISSUES BY CATEGORY");
    lines.push("-".repeat(72));
    for (const code of codes) {
      const items = dedupeIssues(issuesByCode[code] ?? []);
      lines.push(`${code} (${items.length})`);
      for (const item of items.slice(0, 8)) {
        const target = [item.brand, item.model, item.generation].filter(Boolean).join(" ");
        const suffix = item.url ? ` -> ${item.url}` : item.catalogKey ? ` -> ${item.catalogKey}` : "";
        lines.push(`  - ${target || "batch"}: ${item.message}${suffix}`);
      }
      if (items.length > 8) {
        lines.push(`  ... and ${items.length - 8} more`);
      }
    }
  }

  lines.push("");
  lines.push("PER-TARGET SUMMARY");
  lines.push("-".repeat(72));
  for (const run of batchLog.runs ?? []) {
    const label = `${run.brand} ${run.model} (${run.generation})`;
    if (run.skipped) {
      lines.push(`SKIP  ${label} :: ${run.reason}`);
      continue;
    }
    if (run.error) {
      lines.push(`FAIL  ${label} :: ${run.error}`);
      continue;
    }
    const outcome = run.outcome ?? "unknown";
    const counts = run.counts ?? {};
    lines.push(
      `${outcome.toUpperCase().padEnd(5)} ${label} :: configs=${counts.mergedConfigurations ?? 0} specsWritten=${counts.totalSpecsWritten ?? 0} avgSpecs=${run.averageSpecsPerConfiguration ?? 0} issues=${run.issueCount ?? 0}`,
    );
  }

  lines.push("=".repeat(72));
  lines.push(`Run log: ${batchLog.logPath ?? "(not written)"}`);
  lines.push("");
  return lines.join("\n");
}

/**
 * Aggregate per-run reports into a batch-level issues map.
 *
 * @param {Array<object>} runs
 */
export function aggregateBatchIssues(runs) {
  const issuesByCode = {};
  const summary = { success: 0, insufficient: 0, no_data: 0, error: 0, skipped: 0 };

  for (const run of runs) {
    if (run.skipped) {
      summary.skipped += 1;
      continue;
    }
    if (run.error) {
      summary.error += 1;
      if (!issuesByCode[EVENT_CODES.TARGET_ERROR]) {
        issuesByCode[EVENT_CODES.TARGET_ERROR] = [];
      }
      issuesByCode[EVENT_CODES.TARGET_ERROR].push({
        brand: run.brand,
        model: run.model,
        generation: run.generation,
        message: run.error,
      });
      continue;
    }

    const outcome = run.outcome ?? "success";
    if (summary[outcome] !== undefined) {
      summary[outcome] += 1;
    }

    for (const [code, items] of Object.entries(run.report?.issuesByCode ?? {})) {
      if (!issuesByCode[code]) issuesByCode[code] = [];
      issuesByCode[code].push(...items);
    }
  }

  return { issuesByCode, summary };
}
