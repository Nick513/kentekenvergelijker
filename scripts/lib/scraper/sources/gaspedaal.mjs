// Gaspedaal Plan B source. Roles: trim discovery and gap-fill of equipment /
// powertrain spec_keys the brochure did not provide. Listing-derived equipment
// is heuristic (keyword prevalence in ad titles); absence means unknown (omit).
// Generic listing aggregation lives in listing-common.mjs.

import * as cheerio from "cheerio";
import { fetchText, politeDelay } from "../http.mjs";
import { slugify } from "../catalog-key.mjs";
import {
  buildConfigsFromTrim,
  extractJsonLdItemList,
  loadKeywordMap,
  withinGeneration,
} from "./listing-common.mjs";

export const meta = {
  brand: "Gaspedaal",
  sourceTag: "scraped_gaspedaal",
  mappingName: "gaspedaal",
};

const BASE_URL = "https://www.gaspedaal.nl";
const MAX_PAGES_PER_TRIM = 2;

// Facet filter slugs that are not consumer trims.
const NON_TRIM_SLUGS = new Set([
  "automatisch",
  "handmatig",
  "automaat",
  "handgeschakeld",
  "benzine",
  "diesel",
  "hybride",
  "elektrisch",
  "mhev",
  "lpg",
  "hatchback",
  "sedan",
  "stationwagon",
  "suv",
  "cabrio",
  "wit",
  "zwart",
  "grijs",
  "blauw",
  "rood",
  "groen",
  "geel",
  "bruin",
  "zilver",
  "oranje",
  "paars",
]);

function extractTrimSlugs(html, brandSlug, modelSlug) {
  const $ = cheerio.load(html);
  const slugs = new Set();
  const prefix = `/${brandSlug}/${modelSlug}/`;

  $(`a[href^="${prefix}"]`).each((_, element) => {
    const href = $(element).attr("href") ?? "";
    const rest = href.slice(prefix.length).split(/[?#]/)[0];
    if (!rest || rest.includes("/")) return;
    if (/^\d{4}$/.test(rest)) return; // year facet
    if (NON_TRIM_SLUGS.has(rest)) return;
    slugs.add(rest);
  });

  return [...slugs];
}

async function fetchTrimItems(brandSlug, modelSlug, slug, generation, logger) {
  const items = [];

  for (let page = 1; page <= MAX_PAGES_PER_TRIM; page += 1) {
    const url =
      page === 1
        ? `${BASE_URL}/${brandSlug}/${modelSlug}/${slug}`
        : `${BASE_URL}/${brandSlug}/${modelSlug}/${slug}?page=${page}`;

    let html;
    try {
      html = await fetchText(url, { logger, source: "gaspedaal" });
    } catch (error) {
      logger?.recordFetchError?.(error, { url, source: "gaspedaal" });
      logger?.warn?.(`Gaspedaal: fetch failed ${url}`);
      break;
    }

    const pageItems = extractJsonLdItemList(html).filter((item) =>
      withinGeneration(item.productionDate, generation),
    );

    items.push(...pageItems);
    if (pageItems.length === 0) break;
    await politeDelay();
  }

  return items;
}

/**
 * @param {{ brand?: string, model: string, generation: string, specCatalog: Map, logger?: object }} ctx
 * @returns {Promise<Array<object>>}
 */
export async function scrape(ctx) {
  const { brand, model, generation, specCatalog, logger } = ctx;
  if (!brand) {
    throw new Error("Gaspedaal scrape requires brand in context");
  }
  const brandSlug = slugify(brand);
  const modelSlug = slugify(model);
  const keywordMap = await loadKeywordMap(meta.mappingName);

  let indexHtml;
  try {
    indexHtml = await fetchText(`${BASE_URL}/${brandSlug}/${modelSlug}`, {
      logger,
      source: "gaspedaal",
    });
  } catch (error) {
    logger?.recordFetchError?.(error, {
      url: `${BASE_URL}/${brandSlug}/${modelSlug}`,
      source: "gaspedaal",
    });
    logger?.warn?.(`Gaspedaal: index fetch failed`);
    return [];
  }

  const trimSlugs = extractTrimSlugs(indexHtml, brandSlug, modelSlug);
  logger?.info?.(`Gaspedaal: discovered trim slugs: ${trimSlugs.join(", ") || "(none)"}`);

  const configurations = [];

  for (const slug of trimSlugs) {
    await politeDelay();
    const items = await fetchTrimItems(brandSlug, modelSlug, slug, generation, logger);
    if (items.length === 0) continue;

    configurations.push(
      ...buildConfigsFromTrim({
        brand,
        model,
        generation,
        sourceTag: meta.sourceTag,
        trimHint: slug,
        items,
        keywordMap,
        specCatalog,
      }),
    );
  }

  return configurations;
}
