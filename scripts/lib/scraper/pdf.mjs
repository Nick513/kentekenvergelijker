// Download and parse manufacturer brochure PDFs.
// Imports pdf-parse via its library path to avoid the package's debug entry
// point, which tries to read a bundled test PDF when run as a main module.

import pdfParse from "pdf-parse/lib/pdf-parse.js";
import { EVENT_CODES } from "./scrape-report.mjs";

const DEFAULT_USER_AGENT =
  "KentekenvergelijkerCatalogBot/1.0 (+internal catalog enrichment)";

/**
 * Download a PDF as a Buffer.
 *
 * @param {string} url
 * @param {{ logger?: { recordFetchError?: Function, info?: Function }, source?: string }} [options]
 * @returns {Promise<Buffer>}
 */
export async function downloadPdf(url, options = {}) {
  const { logger, source } = options;

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": DEFAULT_USER_AGENT, Accept: "application/pdf" },
    });

    if (!response.ok) {
      const error = new Error(`PDF download failed (HTTP ${response.status}) for ${url}`);
      logger?.recordFetchError?.(error, { url, status: response.status, source });
      throw error;
    }

    const arrayBuffer = await response.arrayBuffer();
    logger?.info?.(`PDF download OK (${arrayBuffer.byteLength} bytes)`, EVENT_CODES.PDF_DOWNLOAD_OK, {
      url,
      bytes: arrayBuffer.byteLength,
      source,
    });
    return Buffer.from(arrayBuffer);
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("HTTP")) {
      logger?.recordFetchError?.(error, { url, source });
    }
    throw error;
  }
}

/**
 * Parse a PDF buffer into raw text. pdf-parse returns text streams in roughly
 * reading order; structural parsing of columns is the caller's responsibility
 * (see sources/hyundai.mjs structural anchors).
 *
 * @param {Buffer} buffer
 * @param {{ url?: string, logger?: { error?: Function }, source?: string }} [options]
 * @returns {Promise<{ text: string, lines: string[], pageCount: number }>}
 */
export async function parsePdfBuffer(buffer, options = {}) {
  const { url, logger, source } = options;

  try {
    const result = await pdfParse(buffer);
    const lines = result.text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    return { text: result.text, lines, pageCount: result.numpages };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger?.error?.(`PDF parse failed: ${message}`, EVENT_CODES.PDF_PARSE_FAILED, {
      url,
      source,
    });
    throw error;
  }
}

/**
 * Convenience: download then parse.
 *
 * @param {string} url
 * @param {{ logger?: object, source?: string }} [options]
 * @returns {Promise<{ text: string, lines: string[], pageCount: number }>}
 */
export async function extractPdfText(url, options = {}) {
  const buffer = await downloadPdf(url, options);
  return parsePdfBuffer(buffer, { url, ...options });
}
