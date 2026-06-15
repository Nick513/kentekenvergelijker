// Parser for the Hyundai NL price list PDF ("Prijslijst"), which contains:
//  - A per-variant pricing table (trim + engine + transmission)
//  - A multi-column technical specs matrix (1.2 MPI | 1.0 T-GDI manual | 1.0 T-GDI auto)
//  - Shared model dimensions
//
// Engine-level specs use the manual column for the 1.0 T-GDI where three columns
// exist (manual / auto differ on consumption and performance). Model-level specs
// (dimensions) are attached to every configuration for the model.

import {
  engineSlugFromDisplacement,
  toDisplayName,
} from "../catalog-key.mjs";
import { buildSpecValue } from "../field-map.mjs";

export const SOURCE_TAG = "scraped_hyundai";

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

const VARIANT_RE =
  /^(1\.\d\s*(?:MPI|T-GDI)(?:\s*48V)?(?:\s*MHEV)?(?:\s*\d+\s*pk)?)\s*(Comfort Smart|Comfort|Premium Sky|Premium|i-Motion|N Line|N)\s*(\d+)\s*%\s*(?:Handgeschakeld|Automaat)\s*(Voorwiel|Vierwiel)\w*\s*([A-G])\s*(\d{2,3})\s*(?:€\s*[\d.]+\s*)+$/;

function parseEuroAmounts(line) {
  return [...line.matchAll(/€\s*([\d.]+)/g)].map((match) => match[1]);
}

/** Parse weight tokens like 988, 1.065, 1.090 from a concatenated PDF tail. */
function parseWeightTokens(tail) {
  const parts = [];
  let rest = tail;
  while (rest.length > 0) {
    const match = rest.match(/^(\d{3}|\d\.\d{3})/);
    if (!match) break;
    parts.push(match[1]);
    rest = rest.slice(match[1].length);
  }
  return parts;
}

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

function parseWeightKg(token) {
  if (!token) return null;
  const normalized = token.replace(/\./g, "");
  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) ? `${parsed} kg` : null;
}

/** Parse the engine-column technical matrix from the price list PDF lines. */
function extractTechByEngine(lines) {
  const tech = [{}, {}];
  const joined = lines.join("\n");

  // Cilinderinhoud spans multiple lines: ")1.197998"
  const displacementMatch = joined.match(/\)1\.(\d{3})(\d{3})/);
  if (displacementMatch) {
    tech[0].engine_displacement_cc = Number.parseInt(`1${displacementMatch[1]}`, 10);
    tech[1].engine_displacement_cc = Number.parseInt(displacementMatch[2], 10);
  }

  for (const line of lines) {
    if (line.startsWith("Aantal cilinders")) {
      const m = line.match(/cilinders(\d)(\d)$/);
      if (m) {
        tech[0].cylinder_count = m[1];
        tech[1].cylinder_count = m[2];
      }
    } else if (line.startsWith("Max. vermogen (pk")) {
      const matches = [...line.matchAll(/(\d+)\s*\(([\d,]+)\)\s*\/\s*([\d.]+)/g)];
      if (matches.length >= 2) {
        tech[0].max_power_engine = `${matches[0][1]} pk (${matches[0][2]} kW) / ${matches[0][3]} tpm`;
        tech[1].max_power_engine = `${matches[1][1]} pk (${matches[1][2]} kW) / ${matches[1][3]} tpm`;
      }
    } else if (line.startsWith("Max. koppel")) {
      const matches = [...line.matchAll(/(\d+)\s*\/\s*(\d\.\d{3})/g)];
      if (matches.length === 2) {
        tech[0].max_torque_engine = `${matches[0][1]} Nm / ${matches[0][2]} tpm`;
        tech[1].max_torque_engine = `${matches[1][1]} Nm / ${matches[1][2]} tpm`;
      }
    } else if (line.startsWith("Topsnelheid")) {
      const m = line.match(/(\d{3})(\d{3})(\d{3})$/);
      if (m) {
        tech[0].top_speed = `${m[1]} km/u`;
        tech[1].top_speed = `${m[2]} km/u`;
      }
    } else if (line.startsWith("Acceleratie 0-100")) {
      const tail = line.split("sec.").pop() ?? "";
      const values = [...tail.matchAll(/(\d{1,2},\d)/g)].map((match) => `${match[1]} s`);
      if (values.length >= 2) {
        tech[0].acceleration_0_100 = values[0];
        tech[1].acceleration_0_100 = values[1];
      }
    } else if (line.includes("McPherson") && !line.includes("Multi-link")) {
      tech[0].front_suspension = "McPherson";
      tech[1].front_suspension = "McPherson";
    } else if (line.startsWith("AchterMulti-link")) {
      tech[0].rear_suspension = "Multi-link";
      tech[1].rear_suspension = "Multi-link";
    } else if (line.includes("rechtop") && line.includes("(l)")) {
      const tail = line.split("(l)").pop();
      const values = tail.match(/\d\.\d{3}|\d{3}/g);
      if (values?.length === 2) {
        tech[0].luggage_volume = `${values[0]} l`;
        tech[1].luggage_volume = `${values[1]} l`;
      }
    } else if (line.includes("neergeklapt") && line.includes("(l)")) {
      const tail = line.split("(l)").pop();
      const values = tail.match(/\d\.\d{3}|\d{3}/g);
      if (values?.length === 2) {
        tech[0].cargo_length_min_max = `${values[0]} l`;
        tech[1].cargo_length_min_max = `${values[1]} l`;
      }
    } else if (line.startsWith("Ledig gewicht")) {
      const tail = line.split("(kg)").pop() ?? "";
      const tokens = parseWeightTokens(tail);
      if (tokens.length >= 2) {
        tech[0].empty_weight_kg = parseWeightKg(tokens[0]);
        tech[1].empty_weight_kg = parseWeightKg(tokens[1]);
      }
    } else if (line.startsWith("Rijklaar gewicht")) {
      const tail = line.split("(kg)").pop() ?? "";
      const tokens = parseWeightTokens(tail);
      if (tokens.length >= 2) {
        tech[0].curb_weight_kg = parseWeightKg(tokens[0]);
        tech[1].curb_weight_kg = parseWeightKg(tokens[1]);
      }
    } else if (line.startsWith("Max. toegestaan gewicht")) {
      const tail = line.split("(kg)").pop() ?? "";
      const tokens = parseWeightTokens(tail);
      if (tokens.length >= 2) {
        tech[0].max_permissible_weight = parseWeightKg(tokens[0]);
        tech[1].max_permissible_weight = parseWeightKg(tokens[1]);
      }
    } else if (line.startsWith("Max. aanhangwagengewicht, ongeremd")) {
      const tail = line.split("(kg)").pop() ?? "";
      const tokens = parseWeightTokens(tail);
      if (tokens.length >= 1) {
        const v = parseWeightKg(tokens[0]);
        tech[0].max_towing_weight_unbraked_kg = v;
        tech[1].max_towing_weight_unbraked_kg = v;
      }
    } else if (line.startsWith("Max. aanhangwagengewicht, geremd")) {
      const tail = line.split("(kg)").pop() ?? "";
      const tokens = parseWeightTokens(tail);
      if (tokens.length >= 2) {
        tech[0].max_towing_weight_braked_kg = parseWeightKg(tokens[0]);
        tech[1].max_towing_weight_braked_kg = parseWeightKg(tokens[1]);
      }
    } else if (line.startsWith("Max. kogeldruk")) {
      const tail = (line.split("(kg)").pop() ?? "").trim();
      const m = tail.match(/^(\d{2,3})(\d{2,3})$/);
      if (m) {
        const v = `${m[1]} kg`;
        tech[0].max_ball_pressure = v;
        tech[1].max_ball_pressure = v;
      }
    } else if (line.startsWith("Inhoud brandstoftank")) {
      const tail = line.split("(l)").pop() ?? "";
      const values = tail.match(/\d{2}/g);
      if (values?.length === 2) {
        tech[0].fuel_tank_capacity = `${values[0]} l`;
        tech[1].fuel_tank_capacity = `${values[1]} l`;
      }
    } else if (line.startsWith("Aantal zitplaatsen")) {
      const m = line.match(/(\d)(\d)$/);
      if (m) {
        tech[0].seat_count = m[1];
        tech[1].seat_count = m[2];
      }
    } else if (line.startsWith("Verbruik gecombineerd")) {
      const tail = line.split("l/100 km)").pop() ?? "";
      const values = [...tail.matchAll(/(\d{1,2},\d)/g)].map((m) => `${m[1]} l/100 km`);
      if (values.length >= 3) {
        tech[0].fuel_consumption_combined_nedc = `${values[0]}-${values[1]}`;
        tech[1].fuel_consumption_combined_nedc = values[2];
      } else if (values.length >= 2) {
        tech[0].fuel_consumption_combined_nedc = values[0];
        tech[1].fuel_consumption_combined_nedc = values[1];
      }
    } else if (line.startsWith("Emissienorm")) {
      const norm = line.replace("Emissienorm", "").trim();
      if (norm) {
        tech[0].emission_standard = norm;
        tech[1].emission_standard = norm;
      }
    }
  }

  // CO2 ranges are split across lines in PDF extraction.
  const co2Match = joined.match(
    /\(g\/km\)(\d{3}-\d{3})(\d{3}-\d{3})(\d{3}-\d{3})/,
  );
  if (co2Match) {
    tech[0].co2_emission_g_km = co2Match[1];
    tech[1].co2_emission_g_km = co2Match[2];
  }

  for (const col of [0, 1]) {
    tech[col].drive_wheels = "Voorwielaandrijving";
    tech[col].drivetrain_fuel = "Benzine (E10)";
    tech[col].propulsion_system = col === 1 ? "Benzine 48V mild-hybrid" : "Benzine";
  }

  return tech;
}

/** Model-level dimensions shared across all trims/engines. */
function extractModelSpecs(lines) {
  const specs = {};
  for (const line of lines) {
    if (line.startsWith("Lengte") && line.includes(".")) {
      specs.vehicle_length_cm = `${line.replace("Lengte", "").trim()} mm`;
    } else if (line.startsWith("Breedte, zonder")) {
      specs.vehicle_width_cm = `${line.replace("Breedte, zonder buitenspiegels", "").trim()} mm`;
    } else if (line.startsWith("Hoogte") && !line.includes("zitvlak")) {
      specs.vehicle_height_cm = `${line.replace("Hoogte", "").trim()} mm`;
    } else if (line.startsWith("Wielbasis")) {
      specs.wheelbase_cm = `${line.replace("Wielbasis", "").trim()} mm`;
    } else if (line.startsWith("Grondspeling")) {
      specs.ground_clearance = line.replace("Grondspeling", "").trim();
    } else if (line.startsWith("Beenruimte")) {
      specs.seat_to_pedal_distance = line.replace("Beenruimte 1e zitrij / 2e zitrij", "").trim();
    } else if (line.startsWith("Breedte interieur op schouderhoogte")) {
      specs.front_interior_width = line
        .replace("Breedte interieur op schouderhoogte 1e zitrij / 2e zitrij", "")
        .trim();
    }
  }
  return specs;
}

function buildSpecs(rawValues, specCatalog, source) {
  const specs = [];
  for (const [specKey, value] of rawValues) {
    const meta = specCatalog.get(specKey);
    if (!meta) continue;
    const built = buildSpecValue(specKey, value, meta);
    if (built) specs.push({ ...built, source });
  }
  return specs;
}

/**
 * Parse the Hyundai price list into catalog configurations.
 */
export function parseHyundaiPriceList(lines, { model, generation, specCatalog }) {
  const tech = extractTechByEngine(lines);
  const modelSpecs = extractModelSpecs(lines);
  const modelSpecEntries = Object.entries(modelSpecs);

  const groups = new Map();
  for (const line of lines) {
    const match = line.match(VARIANT_RE);
    if (!match) continue;

    const engine = mapEngine(match[1]);
    if (!engine) continue;

    const trim = match[2];
    const tax = match[3];
    const energyLabel = match[5];
    const prices = parseEuroAmounts(line);
    const listPrice = prices.length > 0 ? prices[prices.length - 1] : null;
    const engineSlug = engineSlugFromDisplacement(engine.displacementCc, engine.fuel);
    const key = `${trim}|${engineSlug}`;

    if (!groups.has(key)) {
      groups.set(key, {
        trim,
        engineSlug,
        engine,
        labels: [],
        taxes: [],
        listPrices: [],
      });
    }
    const group = groups.get(key);
    group.labels.push(energyLabel);
    group.taxes.push(tax);
    if (listPrice) group.listPrices.push(listPrice.replace(".", ""));
  }

  const configurations = [];
  for (const group of groups.values()) {
    const engineTech = tech[group.engine.techCol] ?? {};
    const rawValues = [
      ["engine_displacement_cc", engineTech.engine_displacement_cc ?? group.engine.displacementCc],
      ["fuel_type", group.engine.fuel],
      ["power_kw", group.engine.powerKw],
      ["energy_label", mostCommon(group.labels)],
      ["company_car_tax", `${mostCommon(group.taxes)}%`],
      ["list_price_ready_to_drive", mostCommon(group.listPrices)],
      ...Object.entries(engineTech).filter(
        ([key]) => !["engine_displacement_cc"].includes(key),
      ),
      ...modelSpecEntries,
    ];

    const specs = buildSpecs(rawValues, specCatalog, SOURCE_TAG);
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
