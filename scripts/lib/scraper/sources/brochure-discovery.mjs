// Discover manufacturer brochure and price-list PDF URLs for a brand/model.

import * as cheerio from "cheerio";
import { slugify } from "../catalog-key.mjs";
import { fetchText } from "../http.mjs";
import { fetchRenderedHtml } from "../browser.mjs";
import { EVENT_CODES, classifyFetchError } from "../scrape-report.mjs";

function normalizeUrl(href, baseUrl) {
  if (!href) return null;
  try {
    return new URL(href, baseUrl).href;
  } catch {
    return null;
  }
}

function modelTokens(model) {
  const slug = slugify(model);
  const compact = slug.replace(/-/g, "");
  return new Set([slug, compact, model.toLowerCase().trim()]);
}

function scoreDocumentLink({ href, text, model, keywords }) {
  const haystack = `${href} ${text}`.toLowerCase();
  const tokens = modelTokens(model);
  const hasModel = [...tokens].some((token) => token.length > 1 && haystack.includes(token));
  if (!hasModel) return 0;

  let score = 1;
  for (const keyword of keywords) {
    if (haystack.includes(keyword)) {
      score += keyword === "prijslijst" ? 4 : 2;
    }
  }
  if (href.toLowerCase().endsWith(".pdf")) {
    score += 3;
  }
  return score;
}

function extractLinksFromHtml(html, baseUrl, model, keywords) {
  const $ = cheerio.load(html);
  const candidates = new Map();

  $("a[href]").each((_, element) => {
    const href = normalizeUrl($(element).attr("href"), baseUrl);
    if (!href) return;
    const text = $(element).text().replace(/\s+/g, " ").trim();
    const score = scoreDocumentLink({ href, text, model, keywords });
    if (score <= 0) return;
    const existing = candidates.get(href);
    if (!existing || score > existing.score) {
      candidates.set(href, { url: href, score, label: text });
    }
  });

  return [...candidates.values()].sort((a, b) => b.score - a.score);
}

async function fetchPageHtml(url, logger) {
  try {
    return await fetchText(url, { logger, source: "brochure-discovery" });
  } catch (error) {
    const classified = classifyFetchError(error);
    if (classified.code === EVENT_CODES.HTTP_NOT_FOUND) {
      throw error;
    }
    logger?.warn?.(
      `Plain fetch failed; trying browser for ${url}`,
      EVENT_CODES.HTTP_FETCH_FAILED,
      { url, source: "brochure-discovery" },
    );
  }

  return fetchRenderedHtml(url, { timeoutMs: 60000, logger, source: "brochure-discovery" });
}

function buildCandidatePages(website, model, templates) {
  const slug = slugify(model);
  const pages = new Set([website]);

  for (const template of templates) {
    pages.add(`${website}${template.replace("{model}", slug)}`);
    pages.add(`${website}${template.replace("{model}", model.toLowerCase().trim())}`);
  }

  return [...pages];
}

/**
 * @param {{
 *   website: string,
 *   model: string,
 *   documentKeywords: string[],
 *   modelPathTemplates: string[],
 *   manualUrls?: string[],
 *   logger?: object
 * }} params
 * @returns {Promise<{ documents: Array<{ url: string, score: number, label: string }>, pagesChecked: number, pagesFailed: number, pagesSucceeded: number }>}
 */
export async function discoverBrochureDocuments(params) {
  const {
    website,
    model,
    documentKeywords,
    modelPathTemplates,
    manualUrls = [],
    logger,
  } = params;

  const discovered = new Map();
  let pagesChecked = 0;
  let pagesFailed = 0;
  let pagesSucceeded = 0;

  for (const manualUrl of manualUrls) {
    discovered.set(manualUrl, { url: manualUrl, score: 100, label: "manual" });
  }

  const pages = buildCandidatePages(website, model, modelPathTemplates);
  logger?.info?.(
    `Brochure discovery: checking ${pages.length} pages on ${website}`,
    EVENT_CODES.BROCHURE_DISCOVERY_START,
    { website, model, pageCount: pages.length },
  );

  for (const pageUrl of pages) {
    pagesChecked += 1;
    try {
      const html = await fetchPageHtml(pageUrl, logger);
      pagesSucceeded += 1;
      const links = extractLinksFromHtml(html, pageUrl, model, documentKeywords);
      for (const link of links) {
        const existing = discovered.get(link.url);
        if (!existing || link.score > existing.score) {
          discovered.set(link.url, link);
        }
      }
    } catch (error) {
      pagesFailed += 1;
      logger?.recordFetchError?.(error, {
        url: pageUrl,
        source: "brochure-discovery",
        website,
        model,
      });
    }
  }

  const documents = [...discovered.values()]
    .filter((entry) => entry.url.toLowerCase().includes(".pdf"))
    .sort((a, b) => b.score - a.score);

  logger?.info?.(
    `Brochure discovery: ${documents.length} PDFs found (${pagesSucceeded}/${pagesChecked} pages OK, ${pagesFailed} failed)`,
    EVENT_CODES.BROCHURE_DISCOVERY_COMPLETE,
    {
      website,
      model,
      pdfCount: documents.length,
      pagesChecked,
      pagesSucceeded,
      pagesFailed,
      topDocuments: documents.slice(0, 5).map((doc) => doc.url),
    },
  );

  return { documents, pagesChecked, pagesFailed, pagesSucceeded };
}
