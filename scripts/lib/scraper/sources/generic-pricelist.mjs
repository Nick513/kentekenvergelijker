// Semi-generic Dutch manufacturer price-list / brochure PDF parser.
// Works best on tabular PDFs with variant rows and labeled spec lines.

import { toDisplayName } from "../catalog-key.mjs";
import { buildSpecValue, matchSpecKey } from "../field-map.mjs";

const VARIANT_RE =
  /^(\d[,.]\d\s*(?:MPI|T-GDI|GDI|CRDi|e-HDi|BlueHDi|PureTech|TSI|TDI|HDi|dcdi|Electric|Elektrisch)?(?:\s*\d+\s*pk)?(?:\s*(?:MHEV|48V|Hybrid|Hybride))?)\s+(.+?)\s+(Handgeschakeld|Automaat|CVT|DSG|iMT|S tronic|e-CVT)\b/i;

const ENGINE_LINE_RE =
  /\b(\d[,.]\d\s*(?:MPI|T-GDI|GDI|CRDi|e-HDi|BlueHDi|PureTech|TSI|TDI|HDi|dcdi)?(?:\s*(?:MHEV|48V|Hybrid|Hybride))?)\b/i;

function parseDisplacementCc(engineRaw) {
  const match = String(engineRaw).match(/(\d)[,.](\d)/);
  if (!match) return null;
  return Number.parseInt(`${match[1]}${match[2]}00`, 10);
}

function inferFuel(engineRaw) {
  const engine = String(engineRaw).toLowerCase();
  if (engine.includes("elektr")) return "Elektrisch";
  if (engine.includes("hybride") || engine.includes("mhev") || engine.includes("48v")) {
    return "Hybride";
  }
  if (engine.includes("crdi") || engine.includes("tdi") || engine.includes("hdi") || engine.includes("dcdi")) {
    return "Diesel";
  }
  return "Benzine";
}

function buildEngineName(engineRaw, transmission) {
  const base = String(engineRaw).replace(/\s+/g, " ").trim();
  const fuel = inferFuel(base);
  const transmissionLabel = transmission ? ` ${transmission}` : "";
  if (fuel === "Hybride" && !base.toLowerCase().includes("hybride")) {
    return `${base} Hybride${transmissionLabel}`.trim();
  }
  return `${base}${transmissionLabel}`.trim();
}

function parseVariantLine(line) {
  const match = line.match(VARIANT_RE);
  if (!match) return null;

  const engineRaw = match[1].replace(",", ".");
  const trimName = toDisplayName(match[2].trim());
  const transmission = match[3];

  return {
    trimName,
    transmission,
    engineName: buildEngineName(engineRaw, transmission),
    specs: [],
  };
}

function parseSharedSpecs(lines, mapping, specCatalog) {
  const shared = [];
  for (const line of lines) {
    const label = line.split(/\s{2,}|\t/)[0]?.trim() ?? line.trim();
    const specMapping = matchSpecKey(mapping, label);
    if (!specMapping) continue;
    const specMeta = specCatalog.get(specMapping.specKey);
    if (!specMeta) continue;

    const valuePart = line.slice(label.length).trim();
    if (!valuePart) continue;
    const specValue = buildSpecValue(specMapping.specKey, valuePart, specMeta);
    if (specValue) {
      shared.push(specValue);
    }
  }
  return shared;
}

function extractFallbackEngine(lines) {
  for (const line of lines) {
    const match = line.match(ENGINE_LINE_RE);
    if (match) {
      return buildEngineName(match[1], null);
    }
  }
  return null;
}

/**
 * @param {string[]} lines
 * @param {{
 *   brand: string,
 *   model: string,
 *   generation: string,
 *   mapping: { byLabel: Map<string, object> },
 *   specCatalog: Map,
 *   sourceTag: string
 * }} ctx
 * @returns {Array<object>}
 */
export function parseGenericPriceList(lines, ctx) {
  const { brand, model, generation, mapping, specCatalog, sourceTag } = ctx;
  const variants = [];
  const sharedSpecs = parseSharedSpecs(lines, mapping, specCatalog);
  const fallbackEngine = extractFallbackEngine(lines);

  for (const line of lines) {
    const variant = parseVariantLine(line);
    if (!variant) continue;
    variant.specs = [...sharedSpecs];
    variants.push(variant);
  }

  if (variants.length === 0 && sharedSpecs.length > 0 && fallbackEngine) {
    variants.push({
      trimName: "Basis",
      engineName: fallbackEngine,
      specs: [...sharedSpecs],
    });
  }

  return variants
    .filter((variant) => variant.trimName && variant.engineName)
    .map((variant) => ({
      brand,
      modelName: model,
      generation,
      trimName: variant.trimName,
      engineName: variant.engineName,
      sourceTag,
      specs: variant.specs.map((spec) => ({ ...spec, source: sourceTag })),
    }));
}
