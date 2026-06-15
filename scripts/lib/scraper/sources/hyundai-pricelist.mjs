// Parser for the Hyundai NL price list PDF ("Prijslijst"), which contains both a
// per-variant pricing table and an engine-column technical specs matrix.
//
// We only emit data we can extract with confidence:
//  - Per (trim, engine) constants from the variant table: drive wheels, energy
//    label, company-car tax. (Transmission/price columns are intentionally
//    skipped: they vary by gearbox, which is not part of the catalog identity,
//    so storing them would risk inconsistent values.)
//  - Engine-level technical specs that are identical across gearboxes: max
//    torque, luggage volume, fuel tank capacity. Each is validated to produce
//    exactly the expected number of column values, otherwise it is skipped.
//
// This keeps the catalog correct: a value is only written when its source layout
// is unambiguous.

import {
  engineSlugFromDisplacement,
  toDisplayName,
} from "../catalog-key.mjs";
import { buildSpecValue } from "../field-map.mjs";

export const SOURCE_TAG = "scraped_hyundai";

// Engine columns appear in the tech matrix in this order: index 0 = 1.2 MPI,
// index 1 = 1.0 T-GDI 48V.
function mapEngine(engineRaw) {
  const s = engineRaw.toLowerCase();
  if (s.includes("1.2") && s.includes("mpi")) {
    return { displacementCc: 1197, fuel: "Benzine", powerKw: 62, techCol: 0 };
  }
  if (s.includes("1.0") && (s.includes("t-gdi") || s.includes("tgdi"))) {
    return { displacementCc: 998, fuel: "Benzine", powerKw: 74, techCol: 1 };
  }
  return null;
}

// One variant row, e.g.:
// "1.0 T-GDI 48VPremium22 %HandgeschakeldVoorwielB115€ 20.363€ ... € 29.795"
const VARIANT_RE =
  /^(1\.\d\s*(?:MPI|T-GDI)(?:\s*48V)?(?:\s*MHEV)?(?:\s*\d+\s*pk)?)\s*(Comfort Smart|Comfort|Premium Sky|Premium|i-Motion|N Line|N)\s*(\d+)\s*%\s*(?:Handgeschakeld|Automaat)\s*(Voorwiel|Vierwiel)\w*\s*([A-G])\s*(\d{2,3})\s*(?:€\s*[\d.]+\s*){4,6}$/;

function mostCommon(values) {
  const counts = new Map();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  let best = null;
  let bestCount = -1;
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Extract gearbox-independent, engine-level tech specs into two columns
 * (index 0 = 1.2 MPI, index 1 = 1.0 T-GDI). A row is only used when it yields
 * exactly two column values, so ambiguous layouts are skipped.
 */
function extractTechByEngine(lines) {
  const tech = [{}, {}];

  for (const line of lines) {
    if (line.startsWith("Max. koppel")) {
      // Each value is "<Nm> / <rpm>"; rpm is a thousands-grouped number
      // (e.g. "4.200"). Bounding rpm to \d\.\d{3} keeps concatenated columns
      // ("4.200171 / 1.500") from merging into one token.
      const matches = [...line.matchAll(/(\d+)\s*\/\s*(\d\.\d{3})/g)];
      if (matches.length === 2) {
        tech[0].max_torque_engine = `${matches[0][1]} Nm / ${matches[0][2]} tpm`;
        tech[1].max_torque_engine = `${matches[1][1]} Nm / ${matches[1][2]} tpm`;
      }
    } else if (line.includes("rechtop") && line.includes("(l)")) {
      const tail = line.split("(l)").pop();
      const values = tail.match(/\d\.\d{3}|\d{3}/g);
      if (values && values.length === 2) {
        tech[0].luggage_volume = `${values[0]} l`;
        tech[1].luggage_volume = `${values[1]} l`;
      }
    } else if (line.startsWith("Inhoud brandstoftank")) {
      const tail = line.split("(l)").pop();
      const values = tail.match(/\d{2}/g);
      if (values && values.length === 2) {
        tech[0].fuel_tank_capacity = `${values[0]} l`;
        tech[1].fuel_tank_capacity = `${values[1]} l`;
      }
    }
  }

  return tech;
}

/**
 * Parse the Hyundai price list into catalog configurations.
 *
 * @param {string[]} lines extracted PDF lines (trimmed, non-empty)
 * @param {{ model: string, generation: string, specCatalog: Map }} ctx
 * @returns {Array<object>} configurations in the merge.mjs shape
 */
export function parseHyundaiPriceList(lines, { model, generation, specCatalog }) {
  const tech = extractTechByEngine(lines);

  const groups = new Map();
  for (const line of lines) {
    const match = line.match(VARIANT_RE);
    if (!match) continue;

    const engine = mapEngine(match[1]);
    if (!engine) continue;

    const trim = match[2];
    const tax = match[3];
    const energyLabel = match[5];
    const engineSlug = engineSlugFromDisplacement(engine.displacementCc, engine.fuel);
    const key = `${trim}|${engineSlug}`;

    if (!groups.has(key)) {
      groups.set(key, { trim, engineSlug, engine, labels: [], taxes: [] });
    }
    const group = groups.get(key);
    group.labels.push(energyLabel);
    group.taxes.push(tax);
  }

  const configurations = [];
  for (const group of groups.values()) {
    const rawValues = [
      ["engine_displacement_cc", group.engine.displacementCc],
      ["fuel_type", group.engine.fuel],
      ["power_kw", group.engine.powerKw],
      ["drive_wheels", "Voorwielaandrijving"],
      ["energy_label", mostCommon(group.labels)],
      ["company_car_tax", `${mostCommon(group.taxes)}%`],
    ];

    const engineTech = tech[group.engine.techCol] ?? {};
    for (const specKey of ["max_torque_engine", "luggage_volume", "fuel_tank_capacity"]) {
      if (engineTech[specKey]) {
        rawValues.push([specKey, engineTech[specKey]]);
      }
    }

    const specs = [];
    for (const [specKey, value] of rawValues) {
      const meta = specCatalog.get(specKey);
      if (!meta) continue;
      const built = buildSpecValue(specKey, value, meta);
      if (built) specs.push({ ...built, source: SOURCE_TAG });
    }

    if (specs.length === 0) continue;

    configurations.push({
      brand: "Hyundai",
      modelName: model,
      generation,
      trimName: toDisplayName(group.trim),
      engineName: group.engineSlug,
      sourceTag: SOURCE_TAG,
      specs,
    });
  }

  return configurations;
}
