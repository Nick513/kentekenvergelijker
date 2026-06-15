// AutoScout24 Plan B source (gap-fill only). Brand-agnostic: trims are inferred
// from listing titles on the brand/model search results page.

import { slugify } from "../catalog-key.mjs";
import { scrapeSearchListings } from "./listing-common.mjs";

export const meta = {
  brand: "AutoScout24",
  sourceTag: "scraped_autoscout24",
  mappingName: "autoscout24",
};

/**
 * @param {{ brand?: string, model: string, generation: string, specCatalog: Map, logger?: object }} ctx
 * @returns {Promise<Array<object>>}
 */
export async function scrape(ctx) {
  const { brand, model, generation, specCatalog, logger } = ctx;
  const base =
    process.env.AUTOSCOUT24_SEARCH_URL ??
    `https://www.autoscout24.nl/lst/${slugify(brand)}/${slugify(model)}`;

  return scrapeSearchListings({
    brand,
    model,
    generation,
    specCatalog,
    sourceTag: meta.sourceTag,
    mappingName: meta.mappingName,
    logger,
    buildPageUrl: (page) => (page === 1 ? base : `${base}?page=${page}`),
  });
}
