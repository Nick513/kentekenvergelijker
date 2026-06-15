// Hyundai manufacturer source (primary). Reads the brochure PDF first, falls
// back to configurator HTML. Returns normalized catalog configurations.
//
// The exact brochure URL per model/generation is an operational input (plan
// open item #1). Provide it via env or the BROCHURE_URLS map below. When no
// source is reachable this adapter returns an empty list and logs a warning;
// the CLI then relies on Plan B for trim discovery.

import * as cheerio from "cheerio";
import { extractPdfText } from "../pdf.mjs";
import { fetchRenderedHtml } from "../browser.mjs";
import { buildSpecValue, matchSpecKey } from "../field-map.mjs";
import { parseHyundaiPriceList } from "./hyundai-pricelist.mjs";

export const meta = {
  brand: "Hyundai",
  sourceTag: "scraped_hyundai",
  mappingName: "hyundai",
};

// Official Hyundai NL price list PDFs (variant table + technical specs matrix).
// Keyed by `${model}:${generation}`. Override per run with HYUNDAI_PRICELIST_URL.
const PRICELIST_URLS = {
  "i20:2020-plus":
    "https://dmassets.hyundai.com/is/content/hyundaiautoeverstage/Prijslijst-Hyundai-i20pdf",
};

// Keyed by `${model}:${generation}`. Override per run with HYUNDAI_BROCHURE_URL
// / HYUNDAI_CONFIGURATOR_URL env vars.
const BROCHURE_URLS = {
  // "i20:2020-plus": "https://www.hyundai.nl/.../i20-brochure.pdf",
};

const CONFIGURATOR_URLS = {
  // "i20:2020-plus": "https://www.hyundai.nl/modellen/i20/uitvoeringen",
};

function resolvePriceListUrl(model, generation) {
  return (
    process.env.HYUNDAI_PRICELIST_URL ??
    PRICELIST_URLS[`${model}:${generation}`] ??
    null
  );
}

// Known consumer trims per model, used as structural anchors when parsing the
// multi-column brochure matrix. Longer names must be matched before shorter ones
// (handled at match time) so "Premium Sky" wins over "Premium".
const KNOWN_TRIMS = {
  i10: ["Comfort Smart", "Comfort", "Premium", "N-Line", "i-Motion"],
  i20: ["Comfort Smart", "Comfort", "Premium Sky", "Premium", "N-Line", "N", "i-Motion"],
  i30: ["Comfort", "Comfort Smart", "Business", "Premium", "N-Line", "N"],
  bayon: ["i-Motion", "Comfort", "Comfort Smart", "Premium", "N-Line"],
  kona: ["i-Motion", "Comfort", "Comfort Smart", "Premium", "Premium Sky", "N-Line"],
  tucson: ["i-Motion", "Comfort", "Comfort Smart", "Premium", "Premium Sky", "N-Line"],
  santa_fe: ["Comfort", "Premium", "Premium Sky"],
};

function knownTrimsForModel(model) {
  return KNOWN_TRIMS[model] ?? KNOWN_TRIMS[model.replace(/-/g, "_")] ?? [];
}

function resolveBrochureUrl(model, generation) {
  return (
    process.env.HYUNDAI_BROCHURE_URL ??
    BROCHURE_URLS[`${model}:${generation}`] ??
    null
  );
}

function resolveConfiguratorUrl(model, generation) {
  return (
    process.env.HYUNDAI_CONFIGURATOR_URL ??
    CONFIGURATOR_URLS[`${model}:${generation}`] ??
    null
  );
}

/**
 * Find the header line that lists the trim columns. A valid header contains at
 * least two known trim names (structural anchor). Longer trim names are matched
 * first so "Premium Sky" wins over "Premium".
 *
 * @returns {{ headerIndex: number, trims: string[] } | null}
 */
function findTrimHeader(lines, knownTrims) {
  const ordered = [...knownTrims].sort((a, b) => b.length - a.length);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const found = [];
    let remaining = line;

    for (const trim of ordered) {
      if (new RegExp(`\\b${escapeRegExp(trim)}\\b`, "i").test(remaining)) {
        found.push(trim);
        remaining = remaining.replace(new RegExp(escapeRegExp(trim), "ig"), " ");
      }
    }

    if (found.length >= 2) {
      // Preserve left-to-right column order as they appear in the line.
      const columns = orderTrimsByPosition(line, found);
      return { headerIndex: index, trims: columns };
    }
  }

  return null;
}

function orderTrimsByPosition(line, trims) {
  return [...trims].sort((a, b) => {
    const posA = line.toLowerCase().indexOf(a.toLowerCase());
    const posB = line.toLowerCase().indexOf(b.toLowerCase());
    return posA - posB;
  });
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Split a spec row into a label and exactly `columnCount` trailing value tokens.
 * Defensive: returns null when the column count does not match, so jumbled rows
 * are skipped rather than written with mis-aligned values.
 */
function splitRow(line, columnCount) {
  // Value tokens are the last `columnCount` whitespace-separated groups.
  const tokens = line.split(/\s{2,}|\t/).map((token) => token.trim()).filter(Boolean);

  if (tokens.length < columnCount + 1) {
    return null;
  }

  const values = tokens.slice(tokens.length - columnCount);
  const label = tokens.slice(0, tokens.length - columnCount).join(" ").trim();

  if (label.length === 0) {
    return null;
  }

  return { label, values };
}

/**
 * Parse the trim matrix from brochure lines using structural anchors.
 * Returns a map of trim name -> array of normalized spec value rows.
 */
function parseTrimMatrix(lines, knownTrims, mapping, specCatalog, logger) {
  const header = findTrimHeader(lines, knownTrims);
  if (!header) {
    logger?.warn?.("Hyundai: no trim header found in brochure text");
    return new Map();
  }

  const { trims } = header;
  const perTrim = new Map(trims.map((trim) => [trim, []]));

  for (let index = header.headerIndex + 1; index < lines.length; index += 1) {
    const split = splitRow(lines[index], trims.length);
    if (!split) {
      continue;
    }

    const specMapping = matchSpecKey(mapping, split.label);
    if (!specMapping) {
      continue;
    }

    const specMeta = specCatalog.get(specMapping.specKey);
    if (!specMeta) {
      continue;
    }

    split.values.forEach((rawValue, columnIndex) => {
      const trim = trims[columnIndex];
      const specValue = buildSpecValue(specMapping.specKey, rawValue, specMeta);
      if (specValue) {
        perTrim.get(trim).push(specValue);
      }
    });
  }

  return perTrim;
}

/**
 * Best-effort engine extraction from technical lines: pick the first marketing
 * engine badge present (e.g. "1.0 T-GDI", "1.2 MPI"). Honest: returns null when
 * not found rather than guessing.
 */
function extractEngineName(lines) {
  const enginePattern = /\b\d\.\d\s*(T-GDI|MPI|GDI|CRDi)(\s*(MHEV|48V))?\b/i;
  for (const line of lines) {
    const match = line.match(enginePattern);
    if (match) {
      return match[0].replace(/\s+/g, " ").trim();
    }
  }
  return null;
}

async function scrapeFromPdf(url, { model, generation, mapping, specCatalog, logger }) {
  const { lines } = await extractPdfText(url);
  const engineName = extractEngineName(lines);
  const perTrim = parseTrimMatrix(
    lines,
    knownTrimsForModel(model),
    mapping,
    specCatalog,
    logger,
  );

  return buildConfigurations(perTrim, { model, generation, engineName });
}

async function scrapeFromHtml(url, { model, generation, mapping, specCatalog, logger }) {
  const html = await fetchRenderedHtml(url);
  const $ = cheerio.load(html);
  const lines = [];

  // Generic table extraction: each row becomes "label  v1  v2 ..." with the
  // double-space delimiter splitRow expects.
  $("table tr").each((_, row) => {
    const cells = $(row)
      .find("th, td")
      .map((__, cell) => $(cell).text().replace(/\s+/g, " ").trim())
      .get()
      .filter(Boolean);
    if (cells.length > 0) {
      lines.push(cells.join("  "));
    }
  });

  const engineName = extractEngineName(lines);
  const perTrim = parseTrimMatrix(
    lines,
    knownTrimsForModel(model),
    mapping,
    specCatalog,
    logger,
  );

  return buildConfigurations(perTrim, { model, generation, engineName });
}

function buildConfigurations(perTrim, { model, generation, engineName }) {
  const configurations = [];

  for (const [trimName, specs] of perTrim.entries()) {
    if (specs.length === 0) {
      continue;
    }

    if (!engineName) {
      // Engine is part of catalog identity; without it we cannot build a key.
      continue;
    }

    configurations.push({
      brand: meta.brand,
      modelName: model,
      generation,
      trimName,
      engineName,
      sourceTag: meta.sourceTag,
      specs,
    });
  }

  return configurations;
}

/**
 * @param {{ model: string, generation: string, mapping: object, specCatalog: Map, logger?: object }} ctx
 * @returns {Promise<Array<object>>}
 */
export async function scrape(ctx) {
  const { model, generation, specCatalog, logger } = ctx;
  const priceListUrl = resolvePriceListUrl(model, generation);
  const brochureUrl = resolveBrochureUrl(model, generation);
  const configuratorUrl = resolveConfiguratorUrl(model, generation);

  if (priceListUrl) {
    try {
      logger?.info?.(`Hyundai: parsing price list ${priceListUrl}`);
      const { lines } = await extractPdfText(priceListUrl);
      const configs = parseHyundaiPriceList(lines, {
        model,
        generation,
        specCatalog,
      });
      if (configs.length > 0) {
        logger?.info?.(`Hyundai: price list yielded ${configs.length} configurations`);
        return configs;
      }
      logger?.warn?.("Hyundai: price list parsed but yielded no configurations");
    } catch (error) {
      logger?.warn?.(
        `Hyundai: price list parse failed (${error instanceof Error ? error.message : error})`,
      );
    }
  }

  if (brochureUrl) {
    try {
      logger?.info?.(`Hyundai: parsing brochure ${brochureUrl}`);
      const fromPdf = await scrapeFromPdf(brochureUrl, ctx);
      if (fromPdf.length > 0) {
        return fromPdf;
      }
      logger?.warn?.("Hyundai: brochure parsed but yielded no configurations");
    } catch (error) {
      logger?.warn?.(
        `Hyundai: brochure parse failed (${error instanceof Error ? error.message : error})`,
      );
    }
  } else {
    logger?.warn?.(
      `Hyundai: no brochure URL for ${model}:${generation} (set HYUNDAI_BROCHURE_URL)`,
    );
  }

  if (configuratorUrl) {
    try {
      logger?.info?.(`Hyundai: parsing configurator ${configuratorUrl}`);
      const fromHtml = await scrapeFromHtml(configuratorUrl, ctx);
      if (fromHtml.length > 0) {
        return fromHtml;
      }
      logger?.warn?.("Hyundai: configurator parsed but yielded no configurations");
    } catch (error) {
      logger?.warn?.(
        `Hyundai: configurator parse failed (${error instanceof Error ? error.message : error})`,
      );
    }
  }

  logger?.warn?.("Hyundai: no manufacturer data; relying on Plan B if enabled");
  return [];
}
