// Write a JSON run summary under scripts/output/ (gitignored). Each run log
// includes structured events (issuesByCode, per-target diagnostics, outcomes)
// for full pipeline feedback.

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(moduleDir, "..", "..", "output");

/**
 * @param {object} summary arbitrary JSON-serializable run summary
 * @returns {Promise<string>} path of the written file
 */
export async function writeRunLog(summary) {
  await mkdir(OUTPUT_DIR, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = path.join(OUTPUT_DIR, `scrape-${timestamp}.json`);
  await writeFile(file, JSON.stringify(summary, null, 2), "utf8");
  return file;
}
