// Download and parse manufacturer brochure PDFs.
// Imports pdf-parse via its library path to avoid the package's debug entry
// point, which tries to read a bundled test PDF when run as a main module.

import pdfParse from "pdf-parse/lib/pdf-parse.js";

const DEFAULT_USER_AGENT =
  "KentekenvergelijkerCatalogBot/1.0 (+internal catalog enrichment)";

/**
 * Download a PDF as a Buffer.
 *
 * @param {string} url
 * @returns {Promise<Buffer>}
 */
export async function downloadPdf(url) {
  const response = await fetch(url, {
    headers: { "User-Agent": DEFAULT_USER_AGENT, Accept: "application/pdf" },
  });

  if (!response.ok) {
    throw new Error(`PDF download failed (HTTP ${response.status}) for ${url}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Parse a PDF buffer into raw text. pdf-parse returns text streams in roughly
 * reading order; structural parsing of columns is the caller's responsibility
 * (see sources/hyundai.mjs structural anchors).
 *
 * @param {Buffer} buffer
 * @returns {Promise<{ text: string, lines: string[], pageCount: number }>}
 */
export async function parsePdfBuffer(buffer) {
  const result = await pdfParse(buffer);
  const lines = result.text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  return { text: result.text, lines, pageCount: result.numpages };
}

/**
 * Convenience: download then parse.
 *
 * @param {string} url
 * @returns {Promise<{ text: string, lines: string[], pageCount: number }>}
 */
export async function extractPdfText(url) {
  const buffer = await downloadPdf(url);
  return parsePdfBuffer(buffer);
}
