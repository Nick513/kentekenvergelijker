// Shared logic for listing-aggregator Plan B sources (Gaspedaal, AutoTrack,
// AutoScout24). Each source provides site-specific trim discovery and URL
// building; the per-trim aggregation (engine grouping, equipment prevalence,
// spec normalization) lives here so adapters stay thin.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as cheerio from "cheerio";
import { buildSpecValue } from "../field-map.mjs";
import { engineSlugFromDisplacement, toDisplayName } from "../catalog-key.mjs";
import { fetchText, politeDelay } from "../http.mjs";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const EQUIPMENT_PREVALENCE_THRESHOLD = 0.3;

export async function loadKeywordMap(sourceName) {
  const file = path.join(moduleDir, "..", "mappings", `${sourceName}.json`);
  const parsed = JSON.parse(await readFile(file, "utf8"));
  return parsed.keywords ?? [];
}

/** Extract schema.org Car items from any embedded JSON-LD ItemList blocks. */
export function extractJsonLdItemList(html) {
  const $ = cheerio.load(html);
  const items = [];

  $('script[type="application/ld+json"]').each((_, element) => {
    const raw = $(element).contents().text();
    if (!raw) return;

    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      return;
    }

    const lists = Array.isArray(data) ? data : [data];
    for (const node of lists) {
      if (node?.["@type"] === "ItemList" && Array.isArray(node.itemListElement)) {
        for (const entry of node.itemListElement) {
          if (entry?.item) items.push(entry.item);
        }
      }
    }
  });

  return items;
}

export function parseVehicleConfiguration(text) {
  const result = { displacementCc: null, powerKw: null };
  if (!text) return result;

  const cc = String(text).match(/(\d{3,4})\s*cc/i);
  if (cc) result.displacementCc = Number.parseInt(cc[1], 10);

  const kw = String(text).match(/(\d{2,3})\s*kW/i);
  if (kw) result.powerKw = Number.parseInt(kw[1], 10);

  return result;
}

export function withinGeneration(productionDate, generation) {
  const year = Number.parseInt(productionDate, 10);
  if (!Number.isFinite(year)) return true;

  const plus = generation.match(/^(\d{4})-plus$/);
  if (plus) return year >= Number.parseInt(plus[1], 10);

  const range = generation.match(/^(\d{4})-(\d{4})$/);
  if (range) {
    return (
      year >= Number.parseInt(range[1], 10) && year <= Number.parseInt(range[2], 10)
    );
  }

  return true;
}

const TRIM_STOP_WORDS = new Set([
  "automaat",
  "automatisch",
  "handgeschakeld",
  "handmatig",
  "benzine",
  "diesel",
  "hybride",
  "elektrisch",
  "mhev",
  "phev",
  "plug-in",
  "plugin",
  "occasion",
  "tweedehands",
  "nieuw",
  "dealer",
  "apk",
  "km",
  "stand",
  "bouwjaar",
  "jaar",
  "airco",
  "navigatie",
  "camera",
  "carplay",
  "android",
  "auto",
  "auto's",
  "personenauto",
  "hatchback",
  "sedan",
  "stationwagon",
  "suv",
  "cabrio",
  "coupe",
  "mpv",
  "bus",
  "van",
]);

/**
 * Infer a trim vocabulary from listing titles for any brand/model. Longer
 * phrases are matched first so "Premium Sky" wins over "Premium".
 */
export function inferTrimVocabFromListings(items, brand, model) {
  const counts = new Map();
  const brandPattern = escapeRegExp(String(brand ?? ""));
  const modelPattern = escapeRegExp(String(model ?? ""));

  for (const item of items) {
    const name = String(item.name ?? "");
    const afterModel = name
      .replace(new RegExp(brandPattern, "i"), " ")
      .replace(new RegExp(modelPattern, "i"), " ")
      .replace(/\b20\d{2}\b/g, " ")
      .replace(/\b\d\.\d\b/g, " ")
      .replace(/\b\d+\s*(cc|kw|pk)\b/gi, " ");

    const matches = name.match(
      /\b([A-Z][A-Za-z0-9]*(?:[ -][A-Z][A-Za-z0-9]*){0,2})\b/g,
    );
    if (!matches) continue;

    for (const phrase of matches) {
      const normalized = phrase.trim();
      const lower = normalized.toLowerCase();
      if (normalized.length < 2) continue;
      if (TRIM_STOP_WORDS.has(lower)) continue;
      if (!afterModel.toLowerCase().includes(lower)) continue;
      counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .map(([trim]) => trim);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
/**
 * Detect a trim name within a listing title using a vocabulary, longest match
 * first so "Premium Sky" wins over "Premium". Returns null when none match.
 */
export function detectTrim(name, vocab) {
  const ordered = [...vocab].sort((a, b) => b.length - a.length);
  const lower = String(name ?? "").toLowerCase();
  for (const trim of ordered) {
    if (lower.includes(trim.toLowerCase())) return trim;
  }
  return null;
}

export function mostCommon(values) {
  const counts = new Map();
  for (const value of values) {
    if (value === null || value === undefined || value === "") continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  let best = null;
  let bestCount = 0;
  for (const [value, count] of counts.entries()) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

/** Split a trim's listings into Premium vs Premium Sky (owner rule). */
export function deriveTrimGroups(trimHint, items) {
  const hint = String(trimHint ?? "").toLowerCase();
  if (hint === "premium" || hint === "premium sky" || hint === "premium-sky") {
    const sky = [];
    const plain = [];
    for (const item of items) {
      const name = (item.name ?? "").toLowerCase();
      if (/premium\s+sky/.test(name)) sky.push(item);
      else plain.push(item);
    }
    const groups = [];
    if (plain.length > 0) groups.push({ trimName: "Premium", items: plain });
    if (sky.length > 0) groups.push({ trimName: "Premium Sky", items: sky });
    return groups;
  }

  const trimName = toDisplayName(String(trimHint ?? "").replace(/-/g, " "));
  return [{ trimName, items }];
}

export function groupByEngine(items) {
  const groups = new Map();

  for (const item of items) {
    const config = parseVehicleConfiguration(item.vehicleConfiguration);
    const fuel = item.fuelType ?? "";
    if (!Number.isFinite(config.displacementCc)) continue;

    const engineSlug = engineSlugFromDisplacement(config.displacementCc, fuel);
    if (!engineSlug) continue;

    if (!groups.has(engineSlug)) {
      const liters = (Math.round(config.displacementCc / 100) / 10).toFixed(1);
      const engineName = [liters, toDisplayName(fuel)].filter(Boolean).join(" ");
      groups.set(engineSlug, { engineName, items: [] });
    }
    groups.get(engineSlug).items.push({ ...item, _config: config });
  }

  return groups;
}

export function buildSpecsForGroup(groupItems, trimName, keywordMap, specCatalog) {
  const specs = [];

  const pushSpec = (specKey, rawValue) => {
    const meta = specCatalog.get(specKey);
    if (!meta) return;
    const built = buildSpecValue(specKey, rawValue, meta);
    if (built) specs.push(built);
  };

  pushSpec("trim_package", trimName);
  pushSpec("transmission", mostCommon(groupItems.map((i) => i.vehicleTransmission)));
  pushSpec("fuel_type", mostCommon(groupItems.map((i) => i.fuelType)));
  pushSpec("body_type", mostCommon(groupItems.map((i) => i.bodyType)));
  pushSpec("door_count", mostCommon(groupItems.map((i) => i.numberOfDoors)));
  pushSpec("power_kw", mostCommon(groupItems.map((i) => i._config?.powerKw)));
  pushSpec(
    "engine_displacement_cc",
    mostCommon(groupItems.map((i) => i._config?.displacementCc)),
  );

  const total = groupItems.length;
  for (const entry of keywordMap) {
    // Title keywords are a "feature present" signal, which only makes sense for
    // boolean equipment specs. Skip non-boolean specs (e.g. cruise_control is a
    // text spec) so we never store "ja" as text.
    const meta = specCatalog.get(entry.specKey);
    if (!meta || meta.displayType !== "boolean") continue;

    const hits = groupItems.filter((item) => {
      const name = (item.name ?? "").toLowerCase();
      return entry.match.some((keyword) => name.includes(keyword));
    }).length;

    if (total > 0 && hits / total >= EQUIPMENT_PREVALENCE_THRESHOLD) {
      pushSpec(entry.specKey, "ja");
    }
  }

  return specs;
}

/**
 * Aggregate a trim's listings into one or more catalog configurations.
 *
 * @returns {Array<object>} configurations (without catalog_key; merge builds it)
 */
/**
 * Generic search-results scraper for sites that expose a brand/model results
 * page with JSON-LD car listings (AutoTrack, AutoScout24). Trims are inferred
 * from listing titles via `trimVocab`. Returns [] (never throws) on fetch or
 * parse problems so a Plan B source can never break a run.
 *
 * @param {{
 *   brand: string, model: string, generation: string, specCatalog: Map,
 *   sourceTag: string, mappingName: string, trimVocab: string[],
 *   buildPageUrl: (page: number) => string, maxPages?: number, logger?: object,
 *   trimVocab?: string[]  // optional; inferred from listing titles when omitted
 * }} params
 * @returns {Promise<Array<object>>}
 */
export async function scrapeSearchListings(params) {
  const {
    brand,
    model,
    generation,
    specCatalog,
    sourceTag,
    mappingName,
    trimVocab,
    buildPageUrl,
    maxPages = 2,
    logger,
  } = params;

  const keywordMap = await loadKeywordMap(mappingName);
  const items = [];

  for (let page = 1; page <= maxPages; page += 1) {
    const url = buildPageUrl(page);
    let html;
    try {
      html = await fetchText(url);
    } catch (error) {
      logger?.warn?.(
        `${sourceTag}: fetch failed ${url} (${error instanceof Error ? error.message : error})`,
      );
      break;
    }

    const pageItems = extractJsonLdItemList(html).filter((item) =>
      withinGeneration(item.productionDate, generation),
    );
    items.push(...pageItems);
    if (pageItems.length === 0) break;
    await politeDelay();
  }

  if (items.length === 0) {
    logger?.warn?.(`${sourceTag}: no JSON-LD listings found`);
    return [];
  }

  const vocab =
    trimVocab && trimVocab.length > 0
      ? trimVocab
      : inferTrimVocabFromListings(items, brand, model);
  if (vocab.length === 0) {
    logger?.warn?.(`${sourceTag}: could not infer trim names from listing titles`);
    return [];
  }
  logger?.info?.(`${sourceTag}: using trim vocab: ${vocab.join(", ")}`);

  const byTrim = new Map();
  for (const item of items) {
    const trim = detectTrim(item.name, vocab);
    if (!trim) continue;
    if (!byTrim.has(trim)) byTrim.set(trim, []);
    byTrim.get(trim).push(item);
  }

  const configurations = [];
  for (const [trim, trimItems] of byTrim.entries()) {
    configurations.push(
      ...buildConfigsFromTrim({
        brand,
        model,
        generation,
        sourceTag,
        trimHint: trim,
        items: trimItems,
        keywordMap,
        specCatalog,
      }),
    );
  }

  return configurations;
}

export function buildConfigsFromTrim({
  brand,
  model,
  generation,
  sourceTag,
  trimHint,
  items,
  keywordMap,
  specCatalog,
}) {
  const configurations = [];

  for (const group of deriveTrimGroups(trimHint, items)) {
    const engineGroups = groupByEngine(group.items);

    for (const [, engineGroup] of engineGroups.entries()) {
      const specs = buildSpecsForGroup(
        engineGroup.items,
        group.trimName,
        keywordMap,
        specCatalog,
      );
      if (specs.length === 0) continue;

      configurations.push({
        brand,
        modelName: model,
        generation,
        trimName: group.trimName,
        engineName: engineGroup.engineName,
        sourceTag,
        specs,
      });
    }
  }

  return configurations;
}
