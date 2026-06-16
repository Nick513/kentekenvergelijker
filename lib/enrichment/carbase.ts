import * as cheerio from "cheerio";
import { fetchHtml } from "@/lib/enrichment/fetch-html";
import type { EnrichedSpecMap } from "@/lib/enrichment/types";
import type { VehicleSnapshot } from "@/lib/rdw/types";

const BASE = "https://www.autoweek.nl";

/**
 * Dutch spec label → spec key mapping for Autoweek/Carbase version pages.
 * Covers both full labels and shortened variants seen in the wild.
 */
const SPEC_LABEL_MAP: Record<string, string> = {
  // General / Algemeen
  "schakeling": "transmission",
  "versnellingsbak": "transmission",
  "versnelling": "transmission",
  "segment": "segment",
  "energielabel": "energy_label",
  "bijtelling": "company_car_tax",
  "classificatie": "classification",
  "introductie": "model_introduction",
  "einde": "model_end",
  "nieuwprijs fiscaal": "fiscal_list_price",
  "nieuwprijs rijklaar": "list_price_ready_to_drive",
  "afleveringskosten": "delivery_costs",
  "wegenbelasting": "road_tax",

  // Powertrain / Motor & aandrijving
  "aandrijflijn": "drivetrain_fuel",
  "aandrijvingssysteem": "propulsion_system",
  "max. vermogen totaal": "max_power_total",
  "max. koppel totaal": "max_torque_total",
  "aandrijving": "drive_wheels",
  "aangedreven wielen": "drive_wheels",

  // Combustion engine / Brandstofmotor
  "cilinders": "cylinder_layout",
  "kleppen per cilinder": "valves_per_cylinder",
  "boring x slag": "bore_x_stroke",
  "compressieverhouding": "compression_ratio",
  "max. vermogen": "max_power_engine",
  "max. koppel": "max_torque_engine",
  "brandstofsysteem": "fuel_system",
  "klepbediening": "valve_actuation",
  "turbo": "turbo",
  "katalysator": "catalytic_converter",
  "brandstoftank": "fuel_tank_capacity",
  "toerental bij 100 km/h (theoretisch)": "rpm_at_100_kmh",
  "toerental bij 130 km/h (theoretisch)": "rpm_at_130_kmh",

  // Performance / Prestaties
  "topsnelheid": "top_speed",
  "acceleratie 0-100 km/h": "acceleration_0_100",
  "acceleratie": "acceleration_0_100",

  // Consumption NEDC / Verbruik NEDC
  "verbruik gecombineerd": "fuel_consumption_combined_nedc",
  "verbruik binnen bebouwde kom": "fuel_consumption_urban_nedc",
  "verbruik buiten bebouwde kom": "fuel_consumption_extra_urban_nedc",
  "stroomverbruik": "electricity_consumption_nedc",
  "actieradius": "electric_range_nedc",

  // Consumption WLTP / Verbruik WLTP
  "verbruik gecombineerd (wltp)": "fuel_consumption_combined_wltp",
  "verbruik gecombineerd wltp": "fuel_consumption_combined_wltp",
  "brandstofverbruik (wltp)": "fuel_consumption_combined_wltp",
  "brandstofverbruik wltp": "fuel_consumption_combined_wltp",
  "elektrisch verbruik (wltp)": "electricity_consumption_wltp",
  "elektrisch verbruik wltp": "electricity_consumption_wltp",
  "actieradius elektrisch (wltp)": "electric_range_wltp",
  "actieradius elektrisch wltp": "electric_range_wltp",
  "actieradius (wltp)": "electric_range_wltp",
  "actieradius wltp": "electric_range_wltp",

  // Electric drivetrain / Elektrische aandrijving
  "elektrisch vermogen": "electric_motor_power",
  "netto elektrisch vermogen": "electric_motor_power",
  "max. elektrisch vermogen": "electric_motor_power",
  "accucapaciteit (bruto)": "battery_capacity_gross",
  "accucapaciteit bruto": "battery_capacity_gross",
  "accucapaciteit (netto)": "battery_capacity_net",
  "accucapaciteit netto": "battery_capacity_net",
  "accucapaciteit": "battery_capacity_net",
  "maximaal laadvermogen ac": "ac_charge_power",
  "laden ac": "ac_charge_power",
  "laadvermogen wisselstroom": "ac_charge_power",
  "maximaal laadvermogen dc": "dc_charge_power",
  "laden dc": "dc_charge_power",
  "laadvermogen gelijkstroom": "dc_charge_power",

  // Luggage / Bagageruimte
  "bagageruimte": "trunk_volume",
  "bagageruimteinhoud": "trunk_volume",
  "kofferruimte": "trunk_volume",
  "laadruimte": "trunk_volume",

  // Chassis / Onderstel
  "wielophanging voor": "front_suspension",
  "wielophanging achter": "rear_suspension",
  "vering voor": "front_springs",
  "vering achter": "rear_springs",
  "stabilisator voor": "front_stabilizer",
  "stabilisator achter": "rear_stabilizer",
  "remmen voor": "front_brakes",
  "remmen achter": "rear_brakes",
  "bandenmaat voor": "front_tire_size",
  "bandenmaat achter": "rear_tire_size",
  "draaicirkel": "turning_circle",

  // Weights / Gewichten
  "max. laadvermogen": "max_payload",
  "max. toelaatbare gewicht": "max_permissible_weight",
  "max. gewicht vooras": "max_front_axle_weight",
  "max. gewicht achteras": "max_rear_axle_weight",
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalize(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, " ");
}

type VersionLink = { href: string; label: string };

function extractVersionLinks($: cheerio.CheerioAPI, modelPathname: string): VersionLink[] {
  const seen = new Set<string>();
  const links: VersionLink[] = [];

  $("a[href]").each((_, el) => {
    const raw = $(el).attr("href") ?? "";
    const href = raw.startsWith("http") ? raw : `${BASE}${raw}`;
    const label = $(el).text().trim();

    // Only collect links that are strictly deeper than the model page
    if (!href.includes(BASE)) return;
    const path = new URL(href).pathname;
    if (
      !path.startsWith(modelPathname) ||
      path === modelPathname ||
      seen.has(path) ||
      !label
    ) return;

    seen.add(path);
    links.push({ href, label });
  });

  return links;
}

function scoreVersion(label: string, snapshot: VehicleSnapshot): number {
  const norm = normalize(label);
  let score = 0;

  // Engine displacement (highest signal: "1.4", "2.0", etc.)
  if (snapshot.engineDisplacementCc) {
    const liters = (snapshot.engineDisplacementCc / 1000).toFixed(1);
    if (norm.includes(liters)) score += 5;
  }

  // Power in pk (high signal if present)
  if (snapshot.powerKw) {
    const pk = Math.round(snapshot.powerKw * 1.35962);
    if (norm.includes(`${pk}pk`) || norm.includes(`${pk} pk`)) score += 6;
    if (norm.includes(`${snapshot.powerKw}kw`)) score += 6;
  }

  // Fuel type
  if (snapshot.fuelType) {
    const fuel = normalize(snapshot.fuelType);
    if (fuel.includes("diesel") && norm.includes("diesel")) score += 3;
    if (
      fuel.includes("benzine") &&
      (norm.includes("benzine") || norm.includes("tsi") || norm.includes("tfsi") ||
        norm.includes("gti") || norm.includes("gsi") || norm.includes("sri"))
    ) score += 2;
    if (
      (fuel.includes("hybride") || fuel.includes("hybrid")) &&
      (norm.includes("hybride") || norm.includes("hybrid") || norm.includes("phev") ||
        norm.includes("mhev") || norm.includes("e-power"))
    ) score += 3;
    if (
      fuel.includes("elektrisch") &&
      (norm.includes("elektrisch") || norm.includes("electric") || norm.includes("ev") ||
        norm.includes("bev"))
    ) score += 4;
  }

  // Trim / variant name from RDW (e.g. "DYNAMICLINE", "EXECUTIVELINE").
  // Strip non-alpha before comparing to handle spacing/casing differences.
  if (snapshot.variant) {
    const variantAlpha = normalize(snapshot.variant).replace(/[^a-z]/g, "");
    const normAlpha = norm.replace(/[^a-z]/g, "");
    if (variantAlpha.length >= 4 && normAlpha.includes(variantAlpha)) score += 4;
  }

  // Year range in label (e.g. "2013-2016")
  if (snapshot.firstRegistrationYear) {
    const y = snapshot.firstRegistrationYear;
    // Matches "YYYY-YYYY" patterns
    const rangeMatch = norm.match(/(\d{4})-(\d{4})/);
    if (rangeMatch) {
      const from = Number(rangeMatch[1]);
      const to = Number(rangeMatch[2]);
      if (y >= from && y <= to) score += 2;
    }
    // Single year
    if (norm.includes(String(y))) score += 1;
  }

  return score;
}

function extractSpecsFromPage($: cheerio.CheerioAPI, versionUrl: string): EnrichedSpecMap {
  const specs: EnrichedSpecMap = new Map();

  function addSpec(rawLabel: string, rawValue: string) {
    const label = normalize(rawLabel);
    const value = rawValue.trim();
    if (!label || !value || value === "-" || value === "–" || value === "n.v.t.") return;
    const specKey = SPEC_LABEL_MAP[label];
    if (!specKey || specs.has(specKey)) return;
    specs.set(specKey, {
      valueText: value,
      valueNumeric: null,
      valueBoolean: null,
      verification: "trim_inferred",
      source: "carbase_autoweek",
      listingUrl: versionUrl,
    });
  }

  // Pattern 1: definition lists (dt/dd pairs)
  $("dl").each((_, dl) => {
    const $dl = $(dl);
    const dts = $dl.find("dt").toArray();
    const dds = $dl.find("dd").toArray();
    dts.forEach((dt, i) => {
      addSpec($(dt).text(), $(dds[i]).text());
    });
  });

  // Pattern 2: table rows (th → td, or first td → second td)
  $("table tr").each((_, tr) => {
    const $tr = $(tr);
    const th = $tr.find("th").first();
    const td = $tr.find("td").first();
    if (th.length && td.length) {
      addSpec(th.text(), td.text());
    } else {
      const cells = $tr.find("td").toArray();
      if (cells.length >= 2) {
        addSpec($(cells[0]).text(), $(cells[1]).text());
      }
    }
  });

  // Pattern 3: list items with colon separator ("Label: Waarde")
  $("li").each((_, li) => {
    const text = $(li).text();
    const colon = text.indexOf(":");
    if (colon > 0) {
      addSpec(text.slice(0, colon), text.slice(colon + 1));
    }
  });

  return specs;
}

export async function searchCarbase(
  snapshot: VehicleSnapshot,
): Promise<EnrichedSpecMap> {
  const brandSlug = slugify(snapshot.brand);
  const modelSlug = slugify(snapshot.modelName);
  const modelPathname = `/carbase/${brandSlug}/${modelSlug}/`;
  const modelUrl = `${BASE}${modelPathname}`;

  const modelHtml = await fetchHtml(modelUrl, { referer: "https://www.google.nl/" });
  if (!modelHtml) return new Map();

  const $model = cheerio.load(modelHtml);
  const versionLinks = extractVersionLinks($model, modelPathname);
  if (versionLinks.length === 0) return new Map();

  // Pick the highest-scoring version
  let bestLink: VersionLink | null = null;
  let bestScore = -1;
  for (const link of versionLinks) {
    const score = scoreVersion(link.label, snapshot);
    if (score > bestScore) {
      bestScore = score;
      bestLink = link;
    }
  }

  if (!bestLink) return new Map();

  const versionHtml = await fetchHtml(bestLink.href, { referer: modelUrl });
  if (!versionHtml) return new Map();

  const $version = cheerio.load(versionHtml);
  return extractSpecsFromPage($version, bestLink.href);
}
