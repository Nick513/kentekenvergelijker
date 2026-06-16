// Resolves manufacturer brochure support from brand-registry + site map.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  BRAND_ADAPTERS,
  DOCUMENT_KEYWORDS,
  MANUFACTURER_WEBSITES,
  MODEL_PATH_TEMPLATES,
} from "./manufacturer-sites.mjs";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const BRAND_REGISTRY_PATH = path.join(moduleDir, "../../../lib/vehicles/brand-registry.json");

let cachedRegistry = null;

async function loadBrandRegistry() {
  if (cachedRegistry) {
    return cachedRegistry;
  }
  const raw = await readFile(BRAND_REGISTRY_PATH, "utf8");
  cachedRegistry = JSON.parse(raw);
  return cachedRegistry;
}

function normalizeBrand(value) {
  return String(value ?? "").trim().toLowerCase();
}

/**
 * @returns {Promise<Array<{ canonical: string, tier: string, website: string | null, adapter: string | null }>>}
 */
export async function listSupportedBrands() {
  const registry = await loadBrandRegistry();
  const brands = [...(registry.active ?? []), ...(registry.legacyRare ?? [])];
  const seen = new Set();

  return brands
    .filter((entry) => {
      const key = normalizeBrand(entry.canonical);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((entry) => ({
      canonical: entry.canonical,
      tier: entry.tier,
      website: MANUFACTURER_WEBSITES[entry.canonical] ?? null,
      adapter: BRAND_ADAPTERS[normalizeBrand(entry.canonical)] ?? null,
    }));
}

/**
 * @param {string} brand
 * @returns {Promise<{ canonical: string, tier: string, website: string | null, adapter: string | null, documentKeywords: string[], modelPathTemplates: string[] } | null>}
 */
export async function getManufacturerEntry(brand) {
  const brands = await listSupportedBrands();
  const match = brands.find((entry) => normalizeBrand(entry.canonical) === normalizeBrand(brand));
  if (!match) {
    return null;
  }

  return {
    ...match,
    documentKeywords: DOCUMENT_KEYWORDS,
    modelPathTemplates: MODEL_PATH_TEMPLATES,
  };
}

export function isBrandInRegistry(brand, registry) {
  const normalized = normalizeBrand(brand);
  const all = [...(registry.active ?? []), ...(registry.legacyRare ?? [])];
  return all.some((entry) => normalizeBrand(entry.canonical) === normalized);
}

export async function loadBrandRegistryForScripts() {
  return loadBrandRegistry();
}
