#!/usr/bin/env node
// Build lib/vehicles/brand-registry.json from RDW open data + curated legacy list.
// Usage: node scripts/generate-brand-registry.mjs [--min-count 1]

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  ACTIVE_BRAND_ALIASES,
  ACTIVE_BRANDS,
  LEGACY_RARE_BRANDS,
  NON_PASSENGER_MERK_PATTERN,
} from "./lib/brand-registry/legacy-curated.mjs";

const RDW_BASE_URL = "https://opendata.rdw.nl/resource";
const VEHICLE_DATASET = "m9d7-ebf2";
const OUTPUT_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "../lib/vehicles/brand-registry.json",
);

function parseArgs(argv) {
  const minCount = Number.parseInt(
    argv.find((arg, index) => argv[index - 1] === "--min-count") ?? "1",
    10,
  );
  return { minCount: Number.isFinite(minCount) ? minCount : 1 };
}

function buildHeaders() {
  const headers = { Accept: "application/json" };
  const token = process.env.RDW_APP_TOKEN?.trim();
  if (token) {
    headers["X-App-Token"] = token;
  }
  return headers;
}

async function fetchBrandCounts() {
  const url = new URL(`${RDW_BASE_URL}/${VEHICLE_DATASET}.json`);
  url.searchParams.set("$select", "merk,count(*) as cnt");
  url.searchParams.set("$where", "voertuigsoort='Personenauto'");
  url.searchParams.set("$group", "merk");
  url.searchParams.set("$order", "cnt DESC");
  url.searchParams.set("$limit", "50000");

  const response = await fetch(url, { headers: buildHeaders() });
  if (!response.ok) {
    throw new Error(`RDW request failed (${response.status})`);
  }

  const rows = await response.json();
  if (!Array.isArray(rows)) {
    throw new Error("Unexpected RDW response shape");
  }

  const counts = new Map();
  for (const row of rows) {
    const merk = row.merk?.trim();
    if (!merk) continue;
    counts.set(merk.toUpperCase(), Number.parseInt(row.cnt, 10) || 0);
  }
  return counts;
}

function sumCounts(rdwMerken, counts) {
  let total = 0;
  const matched = [];
  for (const merk of rdwMerken) {
    const count = counts.get(merk.toUpperCase()) ?? 0;
    if (count > 0) {
      matched.push({ merk, count });
      total += count;
    }
  }
  return { total, matched };
}

function collectAliasMerken() {
  const aliasToCanonical = new Map();
  for (const [canonical, aliases] of Object.entries(ACTIVE_BRAND_ALIASES)) {
    for (const alias of aliases) {
      aliasToCanonical.set(alias.toUpperCase(), canonical);
    }
  }
  return aliasToCanonical;
}

function buildRegistry(counts, minCount) {
  const aliasToCanonical = collectAliasMerken();
  const claimedMerken = new Set();
  const activeCanonical = new Set(ACTIVE_BRANDS.map((name) => name.toUpperCase()));

  const active = ACTIVE_BRANDS.map((canonical) => {
    const aliases = ACTIVE_BRAND_ALIASES[canonical] ?? [];
    const rdwMerken = [canonical, ...aliases];
    const { total, matched } = sumCounts(rdwMerken, counts);
    for (const entry of matched) {
      claimedMerken.add(entry.merk.toUpperCase());
    }
    claimedMerken.add(canonical.toUpperCase());
    return {
      canonical,
      tier: "active",
      marketStatus: "current",
      rdwMerken: matched.map((entry) => entry.merk),
      registeredCount: total,
    };
  }).filter((entry) => entry.registeredCount >= minCount || entry.rdwMerken.length > 0);

  const legacyRare = [];
  for (const brand of LEGACY_RARE_BRANDS) {
    if (activeCanonical.has(brand.canonical.toUpperCase())) {
      continue;
    }
    const { total, matched } = sumCounts(brand.rdwMerken, counts);
    for (const entry of matched) {
      claimedMerken.add(entry.merk.toUpperCase());
    }
    for (const merk of brand.rdwMerken) {
      claimedMerken.add(merk.toUpperCase());
    }

    legacyRare.push({
      canonical: brand.canonical,
      tier: "legacy_rare",
      marketStatus: brand.marketStatus,
      notes: brand.notes ?? null,
      rdwMerken: matched.map((entry) => entry.merk),
      registeredCount: total,
    });
  }

  legacyRare.sort((a, b) => b.registeredCount - a.registeredCount);

  const rdwUnclassified = [];
  for (const [merk, count] of counts.entries()) {
    if (count < 10) continue;
    if (claimedMerken.has(merk)) continue;
    if (aliasToCanonical.has(merk)) continue;
    if (NON_PASSENGER_MERK_PATTERN.test(merk)) continue;
    if (ACTIVE_BRANDS.some((name) => name.toUpperCase() === merk)) continue;

    rdwUnclassified.push({
      rdwMerk: findOriginalMerk(merk, counts),
      registeredCount: count,
    });
  }

  rdwUnclassified.sort((a, b) => b.registeredCount - a.registeredCount);

  const onRoadLegacy = legacyRare.filter((entry) => entry.registeredCount >= minCount);

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    source: {
      dataset: VEHICLE_DATASET,
      filter: "voertuigsoort = Personenauto",
      minCount,
    },
    summary: {
      activeBrandCount: active.length,
      legacyRareBrandCount: legacyRare.length,
      legacyRareOnRoadCount: onRoadLegacy.length,
      rdwUnclassifiedCount: rdwUnclassified.length,
      totalRdwMerken: counts.size,
    },
    active,
    legacyRare,
    rdwUnclassified,
  };
}

function findOriginalMerk(upper, counts) {
  for (const merk of counts.keys()) {
    if (merk === upper) return merk;
  }
  return upper;
}

async function main() {
  const { minCount } = parseArgs(process.argv.slice(2));
  console.log(`Fetching RDW brand counts (minCount=${minCount})...`);
  const counts = await fetchBrandCounts();
  const registry = buildRegistry(counts, minCount);
  writeFileSync(OUTPUT_PATH, `${JSON.stringify(registry, null, 2)}\n`, "utf8");
  console.log(`Wrote ${OUTPUT_PATH}`);
  console.log(
    `Active: ${registry.summary.activeBrandCount}, legacy/rare: ${registry.summary.legacyRareBrandCount} (${registry.summary.legacyRareOnRoadCount} on road), unclassified RDW merken (10+): ${registry.summary.rdwUnclassifiedCount}`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
