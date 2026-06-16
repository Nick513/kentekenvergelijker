// Generic manufacturer brochure source (primary for all registered brands).
// Discovers NL manufacturer PDFs, parses with shared Dutch label mapping, and
// returns normalized catalog configurations. Brand-specific adapters (Hyundai)
// run separately and win on overlapping spec_keys.

import { loadMapping } from "../field-map.mjs";
import { extractPdfText } from "../pdf.mjs";
import { getManufacturerEntry } from "../manufacturer-registry.mjs";
import { discoverBrochureDocuments } from "./brochure-discovery.mjs";
import { parseGenericPriceList } from "./generic-pricelist.mjs";
import { EVENT_CODES } from "../scrape-report.mjs";

export const meta = {
  sourceTag: "scraped_brochure",
  mappingName: "brochure",
};

const MANUAL_DOCUMENT_URLS = {
  "hyundai:i20:2020-plus":
    "https://dmassets.hyundai.com/is/content/hyundaiautoeverstage/Prijslijst-Hyundai-i20pdf",
};

function resolveManualUrls(brand, model, generation) {
  const fromEnv = process.env.BROCHURE_URL?.trim();
  if (fromEnv) {
    return [fromEnv];
  }

  const key = `${brand.toLowerCase()}:${model.toLowerCase()}:${generation.toLowerCase()}`;
  const configured = MANUAL_DOCUMENT_URLS[key];
  return configured ? [configured] : [];
}

async function parseDocument(url, ctx) {
  const { lines, pageCount } = await extractPdfText(url, {
    logger: ctx.logger,
    source: meta.sourceTag,
  });
  const configs = parseGenericPriceList(lines, {
    brand: ctx.brand,
    model: ctx.model,
    generation: ctx.generation,
    mapping: ctx.mapping,
    specCatalog: ctx.specCatalog,
    sourceTag: meta.sourceTag,
  });
  return { configs, pageCount, lineCount: lines.length };
}

/**
 * @param {{
 *   brand: string,
 *   model: string,
 *   generation: string,
 *   specCatalog: Map,
 *   logger?: object
 * }} ctx
 * @returns {Promise<{ configurations: Array<object>, diagnostics: object }>}
 */
export async function scrape(ctx) {
  const { brand, model, generation, specCatalog, logger } = ctx;
  const diagnostics = {
    brand,
    model,
    generation,
    website: null,
    documentsFound: 0,
    documentsAttempted: 0,
    parseAttempts: [],
    discovery: null,
  };

  const entry = await getManufacturerEntry(brand);

  if (!entry) {
    logger?.warn?.(
      `${brand} is not in brand registry; brochure fetch skipped`,
      EVENT_CODES.BRAND_NOT_IN_REGISTRY,
      { brand, model, generation },
    );
    return { configurations: [], diagnostics };
  }

  diagnostics.website = entry.website;
  const mapping = await loadMapping(meta.mappingName);
  const manualUrls = resolveManualUrls(brand, model, generation);

  let documents = manualUrls.map((url) => ({ url, score: 100, label: "manual" }));

  if (entry.website) {
    const discovery = await discoverBrochureDocuments({
      website: entry.website,
      model,
      documentKeywords: entry.documentKeywords,
      modelPathTemplates: entry.modelPathTemplates,
      manualUrls,
      logger,
    });
    documents = discovery.documents;
    diagnostics.discovery = {
      pagesChecked: discovery.pagesChecked,
      pagesSucceeded: discovery.pagesSucceeded,
      pagesFailed: discovery.pagesFailed,
    };
  } else if (manualUrls.length === 0) {
    logger?.warn?.(
      `No NL manufacturer site for ${brand}; set BROCHURE_URL to scrape manually`,
      EVENT_CODES.BRAND_NO_WEBSITE,
      { brand, model, generation },
    );
    return { configurations: [], diagnostics };
  }

  diagnostics.documentsFound = documents.length;

  if (documents.length === 0) {
    logger?.warn?.(
      `No brochure PDFs discovered for ${brand} ${model} (${generation})`,
      EVENT_CODES.BROCHURE_NO_DOCUMENTS,
      { brand, model, generation, website: entry.website },
    );
    return { configurations: [], diagnostics };
  }

  const configurations = [];
  const seenKeys = new Set();
  let duplicateCount = 0;

  for (const document of documents.slice(0, 5)) {
    if (!document.url.toLowerCase().includes(".pdf")) {
      continue;
    }

    diagnostics.documentsAttempted += 1;

    try {
      logger?.info?.(
        `Parsing brochure PDF`,
        EVENT_CODES.BROCHURE_PARSE_START,
        { url: document.url, brand, model, generation },
      );

      const { configs, pageCount, lineCount } = await parseDocument(document.url, {
        brand: entry.canonical,
        model,
        generation,
        mapping,
        specCatalog,
        logger,
      });

      const attempt = {
        url: document.url,
        configurationsParsed: configs.length,
        pageCount,
        lineCount,
        status: configs.length > 0 ? "ok" : "empty",
      };
      diagnostics.parseAttempts.push(attempt);

      for (const config of configs) {
        const key = `${config.trimName}|${config.engineName}`;
        if (seenKeys.has(key)) {
          duplicateCount += 1;
          logger?.record?.(
            "warn",
            EVENT_CODES.BROCHURE_DUPLICATE_CONFIG,
            `Duplicate trim/engine ${key} in ${document.url}`,
            { url: document.url, catalogKey: key },
          );
          continue;
        }
        seenKeys.add(key);
        configurations.push(config);
      }

      if (configurations.length > 0) {
        logger?.info?.(
          `Brochure parse OK: ${configs.length} configs (${configurations.length} unique)`,
          EVENT_CODES.BROCHURE_PARSE_COMPLETE,
          {
            url: document.url,
            configurationsParsed: configs.length,
            uniqueConfigurations: configurations.length,
            pageCount,
            lineCount,
          },
        );
        break;
      }

      logger?.warn?.(
        `PDF parsed but yielded 0 configurations (${lineCount} lines, ${pageCount} pages)`,
        EVENT_CODES.BROCHURE_PARSE_FAILED,
        { url: document.url, lineCount, pageCount },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      diagnostics.parseAttempts.push({
        url: document.url,
        status: "error",
        error: message,
      });
      logger?.warn?.(
        `Brochure parse failed: ${message}`,
        EVENT_CODES.BROCHURE_PARSE_FAILED,
        { url: document.url, brand, model, generation },
      );
    }
  }

  diagnostics.duplicateConfigurationsSkipped = duplicateCount;

  if (configurations.length === 0) {
    logger?.warn?.(
      `Documents found but no configurations parsed for ${brand} ${model}`,
      EVENT_CODES.BROCHURE_PARSE_FAILED,
      {
        brand,
        model,
        generation,
        documentsFound: documents.length,
        parseAttempts: diagnostics.parseAttempts,
      },
    );
  }

  return { configurations, diagnostics };
}
