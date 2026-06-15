// Field mapping: source-specific labels -> spec_key, plus value normalization
// into the correct column (value_text / value_numeric / value_boolean) based on
// the display_type recorded in the `specifications` table.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const MAPPINGS_DIR = path.join(moduleDir, "mappings");

const DISPLAY_TYPES_NUMERIC = new Set([
  "currency",
  "power_kw",
  "distance_km",
  "mass_kg",
  "volume_cc",
  "year",
  "length_cm",
  "co2_g_km",
]);

// Tokens that clearly mean "standard on this trim". Anything else is treated as
// unknown and the equipment row is omitted (never stored as false).
const BOOLEAN_TRUE_TOKENS = new Set([
  "ja",
  "standaard",
  "std",
  "serie",
  "•",
  "●",
  "✓",
  "▪",
  "■",
  "x",
]);

export function normalizeLabel(label) {
  return String(label ?? "")
    .toLowerCase()
    .replace(/:/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Load a source mapping file and index it by normalized source label.
 *
 * @param {string} sourceName e.g. "hyundai", "gaspedaal"
 * @returns {Promise<{ specs: Array<object>, byLabel: Map<string, object> }>}
 */
export async function loadMapping(sourceName) {
  const file = path.join(MAPPINGS_DIR, `${sourceName}.json`);
  const raw = await readFile(file, "utf8");
  const parsed = JSON.parse(raw);

  const byLabel = new Map();
  for (const spec of parsed.specs ?? []) {
    for (const label of spec.sourceLabels ?? []) {
      byLabel.set(normalizeLabel(label), spec);
    }
  }

  return { specs: parsed.specs ?? [], byLabel };
}

/**
 * Resolve a raw source label to a mapping entry, or null if unmapped.
 *
 * @param {{ byLabel: Map<string, object> }} mapping
 * @param {string} sourceLabel
 * @returns {object | null}
 */
export function matchSpecKey(mapping, sourceLabel) {
  return mapping.byLabel.get(normalizeLabel(sourceLabel)) ?? null;
}

/**
 * Load spec_key -> { valueSource, displayType } from the specifications table.
 * Used to validate spec keys and to choose the storage column.
 *
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @returns {Promise<Map<string, { valueSource: string, displayType: string }>>}
 */
export async function loadSpecCatalog(supabase) {
  const { data, error } = await supabase
    .from("specifications")
    .select("spec_key, value_source, display_type");

  if (error) {
    throw new Error(`Failed to load specifications: ${error.message}`);
  }

  const catalog = new Map();
  for (const row of data ?? []) {
    catalog.set(row.spec_key, {
      valueSource: row.value_source,
      displayType: row.display_type,
    });
  }
  return catalog;
}

function parseBoolean(rawValue) {
  const token = String(rawValue ?? "").trim().toLowerCase();
  if (token.length === 0) {
    return null;
  }
  return BOOLEAN_TRUE_TOKENS.has(token) ? true : null;
}

/**
 * Parse a Dutch-formatted number from free text.
 * Handles thousands dots ("1.197") and decimal commas ("10,4").
 */
function parseNumeric(rawValue) {
  const match = String(rawValue ?? "").match(/-?\d[\d.,]*/);
  if (!match) {
    return null;
  }

  let token = match[0];
  if (token.includes(",")) {
    token = token.replace(/\./g, "").replace(",", ".");
  } else {
    token = token.replace(/,/g, "");
  }

  const parsed = Number.parseFloat(token);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Build a spec value row for the given spec_key and raw value, choosing the
 * column from the spec's display_type. Returns null when the value is unusable
 * (so the caller omits the row instead of storing a blank or false).
 *
 * @param {string} specKey
 * @param {unknown} rawValue
 * @param {{ displayType: string }} specMeta
 * @returns {{ spec_key: string, value_text?: string, value_numeric?: number, value_boolean?: boolean } | null}
 */
export function buildSpecValue(specKey, rawValue, specMeta) {
  const displayType = specMeta?.displayType ?? "text";

  if (displayType === "boolean") {
    const value = parseBoolean(rawValue);
    return value === true ? { spec_key: specKey, value_boolean: true } : null;
  }

  if (DISPLAY_TYPES_NUMERIC.has(displayType)) {
    const value = parseNumeric(rawValue);
    return value === null ? null : { spec_key: specKey, value_numeric: value };
  }

  const text = String(rawValue ?? "").replace(/\s+/g, " ").trim();
  return text.length > 0 ? { spec_key: specKey, value_text: text } : null;
}
