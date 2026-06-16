import * as cheerio from "cheerio";
import { fetchHtml } from "@/lib/enrichment/fetch-html";
import type { EnrichedSpecMap } from "@/lib/enrichment/types";
import type { VehicleSnapshot } from "@/lib/rdw/types";

const BASE = "https://www.autoweek.nl";

// ---------------------------------------------------------------------------
// Label maps: Dutch carbase label → spec key
// ---------------------------------------------------------------------------

/** Labels that are unambiguous regardless of section. */
const SPEC_LABEL_MAP: Record<string, string> = {
  // BASISKENMERKEN / Algemeen
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
  "carrosserie": "body_type",
  "aantal zitplaatsen": "seat_count",
  "aantal deuren": "door_count",

  // TYPEGOEDKEURING (for variant/version matching)
  "typegoedkeuringsnummer": "type_approval_number",
  "eu-typegoedkeuringsnummer": "type_approval_number",
  "typegoedkeuring": "type_approval_number",
  "variant": "eu_variant_code",
  "versie": "eu_version_code",
  "variantcode": "eu_variant_code",
  "versiecode": "eu_version_code",

  // MOTORISERING
  "aandrijflijn": "drivetrain_fuel",
  "aandrijvingssysteem": "propulsion_system",
  "aandrijvingssyteem": "propulsion_system",
  "max. vermogen totaal": "max_power_total",
  "max. koppel totaal": "max_torque_total",
  "aandrijving": "drive_wheels",
  "aangedreven wielen": "drive_wheels",

  // BRANDSTOFMOTOR
  "cilinders": "cylinder_layout",
  "kleppen per cilinder": "valves_per_cylinder",
  "cilinderinhoud": "engine_displacement_cc",
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

  // PRESTATIES
  "topsnelheid": "top_speed",
  "acceleratie 0-100 km/h": "acceleration_0_100",
  "acceleratie": "acceleration_0_100",

  // ONDERSTEL
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

  // GEWICHTEN
  "gewicht leeg": "empty_weight_kg",
  "max. laadvermogen": "max_payload",
  "max. toelaatbare gewicht": "max_permissible_weight",
  "max. gewicht vooras": "max_front_axle_weight",
  "max. gewicht achteras": "max_rear_axle_weight",
  "max. trekgewicht geremd": "max_towing_weight_braked_kg",
  "max. trekgewicht ongeremd": "max_towing_weight_unbraked_kg",
  "max. kogeldruk": "max_ball_pressure",
  "max. dakbelasting": "max_roof_load",

  // BAGAGE / LAADRUIMTE
  "inhoud": "luggage_volume",
  "bagageruimte": "luggage_volume",
  "bagageruimteinhoud": "luggage_volume",
  "kofferruimte": "luggage_volume",
  "laadruimte": "luggage_volume",
  "lengte min./max.": "cargo_length_min_max",
  "breedte min./max.": "cargo_width_min_max",
  "hoogte tildrempel": "load_sill_height",

  // EXTERIEURMATEN
  "lengte": "vehicle_length_cm",
  "breedte": "vehicle_width_cm",
  "hoogte": "vehicle_height_cm",
  "wielbasis": "wheelbase_cm",
  "spoorbreedte voor": "front_track_width",
  "spoorbreedte achter": "rear_track_width",
  "bodemvrijheid": "ground_clearance",

  // INTERIEURMATEN
  "afstand rugleuning/pedalen": "seat_to_pedal_distance",
  "hoofdruimte voor": "front_headroom",
  "lengte rugleuning voor": "front_backrest_length",
  "lengte zitting voor": "front_seat_length",
  "instaphoogte voor": "front_entry_height",
  "interieurbreedte voor": "front_interior_width",

  // VEILIGHEID
  "botsproef resultaat": "crash_test_result",
  "abs": "abs",
  "remkrachtverdeling": "brake_force_distribution",
  "remassistent": "brake_assist",
  "botswaarschuwingssysteem": "collision_warning",
  "autonome noodremassistentie": "autonomous_emergency_braking",
  "noodremassistent voetgangers": "pedestrian_emergency_braking",
  "stabiliteitsregeling": "stability_control",
  "tractiecontrole": "traction_control",
  "sperdifferentieel": "limited_slip_differential",
  "automatisch geregelde schokdemping": "adaptive_dampers",
  "automatische niveauregeling": "automatic_level_control",
  "hill assist": "hill_assist",
  "lane assist": "lane_assist",
  "stuurassistent": "steering_assist",
  "dodehoekassistent": "blind_spot_monitor",
  "vermoeidheidssensor": "fatigue_detection",
  "bandenspanningsensor": "tire_pressure_monitor",
  "nachtzicht met persoonsherkenning": "night_vision",
  "precrash systeem": "precrash_system",
  "grootlicht assistent": "high_beam_assist",
  "verkeersbordenherkenning": "traffic_sign_recognition",
  "cross traffic warning": "cross_traffic_warning",
  "airbag bestuurder": "driver_airbag",
  "airbag passagier": "passenger_airbag",
  "zij-airbags": "side_airbags",
  "hoofd/gordijnairbags": "curtain_airbags",
  "knieairbag bestuurder": "driver_knee_airbag",
  "isofix bevestigingsbeugel": "isofix",
  "emergency call": "emergency_call",

  // COMFORT
  "centrale deurvergrendeling": "central_locking",
  "keyless entry/start": "keyless_entry",
  "keyless entry": "keyless_entry",
  "keyless start": "keyless_entry",
  "smartphone key": "smartphone_key",
  "startknop": "start_button",
  "stuurschakeling": "paddle_shifters",
  "elektrische ramen": "electric_windows",
  "stuurbekrachtiging": "power_steering",
  "cruise control": "cruise_control",
  "airconditioning": "air_conditioning",
  "links/rechts gesch. temperatuurreg.": "dual_zone_climate_control",
  "achteruitrijcamera": "parking_camera",
  "inparkeerautomaat": "parking_assist",
  "elektrische parkeerrem": "electric_parking_brake",
  "start/stop-systeem": "start_stop_system",

  // INTERIEUR
  "hoogteverstelling voorstoelen": "front_seat_height_adjustment",
  "lendensteunverstelling voorstoelen": "front_seat_lumbar_support",
  "elektrische stoelverstelling": "electric_seats",
  "verwarmde zitplaatsen": "heated_seats",
  "geventileerde voorstoelen": "ventilated_front_seats",
  "sportstoelen": "sport_seats",
  "met leer bekleed stuur": "leather_steering_wheel",
  "verstelbaar stuur": "adjustable_steering_wheel",
  "verwarmd stuur": "heated_steering_wheel",
  "leren bekleding": "leather_upholstery",
  "hoofdsteunen achter": "rear_headrests",
  "neerklapbare achterbank": "folding_rear_seats",
  "verschuifbare achterbank": "sliding_rear_seats",
  "middenarmsteun": "center_armrest",
  "voorverwarmingsinstallatie": "preheater",
  "automatisch dimmende binnenspiegel": "auto_dimming_rearview_mirror",
  "leeslampje(s)": "reading_lights",
  "verlichte make-up spiegel": "vanity_mirror_light",
  "regelbare dashboardverlichting": "adjustable_dashboard_lighting",
  "toerenteller": "tachometer",
  "dagteller": "tripmeter",
  "koelwatertemperatuurmeter": "coolant_temperature_gauge",
  "buitentemperatuurmeter": "outside_temperature_gauge",
  "boardcomputer": "trip_computer",
  "digital instrumentarium": "digital_instrument_cluster",
  "headup display": "head_up_display",
  "audioinstallatie": "audio_system",
  "digitale radio (dab+)": "dab_radio",
  "stuurwielbediening voor audio": "steering_wheel_audio_controls",
  "audio-ingang": "audio_input",
  "navigatiesysteem": "navigation",
  "bluetooth": "bluetooth",
  "draadloos laden smartphone": "wireless_phone_charging",
  "apple carplay": "apple_carplay",
  "android auto": "android_auto",
  "over-the-air updates": "over_the_air_updates",

  // EXTERIEUR
  "regensensor": "rain_sensor",
  "lichtmetalen velgen": "alloy_wheels",
  "schuif/kanteldak": "sunroof",
  "panoramadak": "panoramic_roof",
  "dakrails": "roof_rails",
  "metallic lak": "metallic_paint",
  "meegespoten bumpers": "color_matched_bumpers",
  "getint glas": "tinted_glass",
  "privacy glas achter": "privacy_rear_glass",
  "elektrisch te openen bagageruimte": "electric_tailgate",
  "elektrische buitenspiegels": "power_mirrors",
  "inklapbare buitenspiegels": "folding_mirrors",
  "automatisch dimmende buitenspiegels": "auto_dimming_mirrors",
  "richtingaanwijzer in buitenspiegels": "turn_signal_mirrors",
  "mistlampen voor": "fog_lights",
  "automatisch inschakelende verlichting": "automatic_headlights",
  "xenon koplampen": "xenon_headlights",
  "led koplampen": "led_headlights",
  "led achterlichten": "led_taillights",
  "koplampsproeiers": "headlight_washers",
  "inbraakalarm": "alarm",

  // SERVICE & GARANTIE
  "onderhoudsbeurt": "service_interval",
  "algemene garantie": "general_warranty",
  "carrosserie garantie": "body_warranty",
};

/** Labels inside a NEDC consumption section. */
const NEDC_LABEL_MAP: Record<string, string> = {
  "verbruik gecombineerd": "fuel_consumption_combined_nedc",
  "verbruik binnen bebouwde kom": "fuel_consumption_urban_nedc",
  "verbruik buiten bebouwde kom": "fuel_consumption_extra_urban_nedc",
  "co2-uitstoot": "co2_emission_nedc_g_km",
  "stroomverbruik": "electricity_consumption_nedc",
  "actieradius": "electric_range_nedc",
};

/** Labels inside a WLTP consumption section. */
const WLTP_LABEL_MAP: Record<string, string> = {
  "verbruik gecombineerd": "fuel_consumption_combined_wltp",
  "co2-uitstoot": "co2_emission_g_km",
  "stroomverbruik": "electricity_consumption_wltp",
  "actieradius": "electric_range_wltp",
};

const SKIP_VALUES = new Set([
  "-", "–", "—", "n.b.", "n.v.t.", "nvt", "n/a",
  "niet beschikbaar", "niet van toepassing", "onbekend",
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

type VersionLink = {
  href: string;
  label: string;
  /** Production year range extracted from the model overview row (if available). */
  yearFrom?: number;
  yearTo?: number;
};

const AUTO_VERSION_RE = /^\/auto\/\d+\//;

function extractVersionLinks($: cheerio.CheerioAPI): VersionLink[] {
  const seen = new Set<string>();
  const links: VersionLink[] = [];

  $(".carbase-version-row, .carbase-versions-body tr").each((_, row) => {
    const $row = $(row);

    // Find the version link inside the row (must match /auto/<id>/ pattern)
    const a = $row.find("a[href]").toArray().find((el) => {
      const raw = $(el).attr("href") ?? "";
      const path = raw.startsWith("http") ? new URL(raw).pathname : raw;
      return AUTO_VERSION_RE.test(path);
    });
    if (!a) return;

    const raw = $(a).attr("href") ?? "";
    const href = raw.startsWith("http") ? raw : `${BASE}${raw}`;
    const label = $(a).text().trim();
    const path = new URL(href).pathname;

    if (seen.has(path) || !label) return;

    // Try to extract a year range from the row text (e.g. "2020 - 2023" or "2020 - heden")
    const rowText = $row.text();
    const yearMatch = rowText.match(/(\d{4})\s*[-–—]\s*(\d{4}|heden)/i);
    const yearFrom = yearMatch ? Number(yearMatch[1]) : undefined;
    const yearTo = yearMatch
      ? yearMatch[2].toLowerCase() === "heden"
        ? new Date().getFullYear()
        : Number(yearMatch[2])
      : undefined;

    seen.add(path);
    links.push({ href, label, yearFrom, yearTo });
  });

  // Fallback: anchor-only approach (no year range) when row selection yields nothing
  if (links.length === 0) {
    $(".carbase-version-row a[href], .carbase-versions-body a[href]").each((_, el) => {
      const raw = $(el).attr("href") ?? "";
      const href = raw.startsWith("http") ? raw : `${BASE}${raw}`;
      const label = $(el).text().trim();
      const path = new URL(href).pathname;
      if (!AUTO_VERSION_RE.test(path) || seen.has(path) || !label) return;
      seen.add(path);
      links.push({ href, label });
    });
  }

  return links;
}

// ---------------------------------------------------------------------------
// Phase-1 scoring: label + year range signals (no extra fetches)
// ---------------------------------------------------------------------------

function scoreVersion(link: VersionLink, snapshot: VehicleSnapshot): number {
  const norm = normalize(link.label);
  let score = 0;

  if (snapshot.engineDisplacementCc) {
    const liters = (snapshot.engineDisplacementCc / 1000).toFixed(1);
    if (norm.includes(liters)) score += 5;
  }

  if (snapshot.powerKw) {
    const pk = Math.round(snapshot.powerKw * 1.35962);
    if (norm.includes(`${pk}pk`) || norm.includes(`${pk} pk`)) score += 6;
    if (norm.includes(`${snapshot.powerKw}kw`)) score += 6;
  }

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

  if (snapshot.variant) {
    const variantAlpha = normalize(snapshot.variant).replace(/[^a-z]/g, "");
    const normAlpha = norm.replace(/[^a-z]/g, "");
    if (variantAlpha.length >= 4 && normAlpha.includes(variantAlpha)) score += 4;
  }

  // Year scoring: prefer extracted year range (reliable) over label text (rare)
  if (snapshot.firstRegistrationYear) {
    const y = snapshot.firstRegistrationYear;

    if (link.yearFrom !== undefined && link.yearTo !== undefined) {
      if (y >= link.yearFrom && y <= link.yearTo) {
        score += 3;
        // Bonus for tight ranges — they're more specific about the exact model year
        if (link.yearTo - link.yearFrom <= 2) score += 1;
      } else {
        // Hard penalty: registration year outside the version's production window
        score -= 4;
      }
    } else {
      // Fallback: year range or exact year in label text
      const rangeMatch = norm.match(/(\d{4})-(\d{4})/);
      if (rangeMatch) {
        const from = Number(rangeMatch[1]);
        const to = Number(rangeMatch[2]);
        if (y >= from && y <= to) score += 2;
      }
      if (norm.includes(String(y))) score += 1;
    }
  }

  return score;
}

// ---------------------------------------------------------------------------
// Trim-tier diversity: ensures premium trims aren't crowded out by base-tier ties
// ---------------------------------------------------------------------------

/**
 * Assigns a trim tier (0-5) based on keywords in the version label.
 * Used to ensure candidate diversity when many versions tie on phase-1 score.
 */
function trimTier(label: string): number {
  const l = label.toLowerCase();
  if (/premium|ultimate|luxury|shine|xclusive|executive|prestige/.test(l)) return 5;
  if (/smart|elegance|n line|sport line|gt line|style|technology|innovation/.test(l)) return 4;
  if (/\bcomfort\b/.test(l)) return 3;
  if (/motion|emotion/.test(l)) return 2;
  if (/\bdrive\b|\baccess\b|\bentry\b/.test(l)) return 1;
  return 0;
}

type ScoredLink = VersionLink & { score: number };

/**
 * Selects up to `max` candidates from `eligible` using trim-tier diversity.
 * Guarantees that each represented tier gets at least one slot, so a Premium
 * variant is never crowded out by multiple Comfort entries of the same score.
 */
function selectCandidates(eligible: ScoredLink[], max: number): ScoredLink[] {
  if (eligible.length <= max) return eligible;

  const selected: ScoredLink[] = [];
  const usedHrefs = new Set<string>();

  // Group by tier; within each group order is preserved (highest phase-1 score first)
  const buckets = new Map<number, ScoredLink[]>();
  for (const c of eligible) {
    const tier = trimTier(c.label);
    if (!buckets.has(tier)) buckets.set(tier, []);
    buckets.get(tier)!.push(c);
  }

  // Pick one representative per tier (highest tier first)
  for (const tier of [5, 4, 3, 2, 1, 0]) {
    if (selected.length >= max) break;
    const bucket = buckets.get(tier);
    if (bucket?.length) {
      selected.push(bucket[0]);
      usedHrefs.add(bucket[0].href);
    }
  }

  // Fill any remaining slots from eligible in original order
  for (const c of eligible) {
    if (selected.length >= max) break;
    if (!usedHrefs.has(c.href)) {
      selected.push(c);
      usedHrefs.add(c.href);
    }
  }

  return selected;
}

// ---------------------------------------------------------------------------
// Phase-2 deep scoring: signals extracted from the fetched version page
// ---------------------------------------------------------------------------

/** Parse Dutch-formatted currency text (e.g. "€ 24.442") into an integer. */
function parseDutchCurrency(text: string): number | null {
  // Dutch thousands separator is "." — strip it and the currency symbol
  const cleaned = text.replace(/[€\s]/g, "").replace(/\./g, "");
  const num = Number(cleaned);
  return Number.isFinite(num) && num > 0 ? num : null;
}

/**
 * Extract the year-specific list price from carbase's "HISTORISCHE NIEUWPRIJZEN" table.
 * These match the RDW catalogusprijs far more reliably than the current-year fiscal price,
 * which drifts upward as the manufacturer updates pricing.
 */
function extractHistoricalPrice(html: string, year: number): number | null {
  const match = html.match(
    new RegExp(`Nieuwprijs\\s+${year}[^<]*<\\/td>\\s*<td>([^<]+)`),
  );
  if (!match) return null;
  return parseDutchCurrency(match[1]);
}

/** Normalise a type approval number for comparison (strip trailing codes). */
function normalizeApproval(raw: string): string {
  // e.g. "e5*2007/46*0121*01" → compare first three segments
  return raw.toLowerCase().replace(/\s+/g, "").split("*").slice(0, 3).join("*");
}

/**
 * Score a fetched version page against the RDW snapshot.
 * Higher = more likely to be the correct trim.
 *
 * @param specs   Structured specs extracted from the page
 * @param rawHtml Raw HTML of the version page (for code-level substring search)
 * @param snapshot RDW snapshot for the vehicle
 */
function scoreDeep(
  specs: EnrichedSpecMap,
  rawHtml: string,
  snapshot: VehicleSnapshot,
): number {
  let score = 0;

  // Signal 1: list price proximity
  // Priority 1a — year-specific historical price from carbase's "HISTORISCHE NIEUWPRIJZEN"
  // table. This matches the RDW catalogusprijs (the price at time of registration) far more
  // reliably than the current "nieuwprijs fiscaal", which drifts as manufacturers update
  // pricing year-over-year.
  // Priority 1b — fall back to current fiscal price if no historical entry exists.
  if (snapshot.catalogPrice) {
    const historicalPrice = snapshot.firstRegistrationYear
      ? extractHistoricalPrice(rawHtml, snapshot.firstRegistrationYear)
      : null;
    const referencePrice = historicalPrice ?? (() => {
      const spec = specs.get("fiscal_list_price");
      return spec?.valueText ? parseDutchCurrency(spec.valueText) : null;
    })();

    if (referencePrice !== null) {
      const diff = Math.abs(referencePrice - snapshot.catalogPrice) / snapshot.catalogPrice;
      if (diff < 0.01) score += 12;       // near-exact — very likely correct trim
      else if (diff < 0.05) score += 7;
      else if (diff < 0.15) score += 2;
      else score -= 5;                     // >15% off — probably wrong trim
    }
  }

  // Signal 2: EU type approval number
  // Shared across a model generation, so alone it only confirms the right generation.
  // Combined with variant/version codes below it gets much more specific.
  const typeSpec = specs.get("type_approval_number");
  if (typeSpec?.valueText && snapshot.typeApprovalNumber) {
    const pageVal = normalizeApproval(typeSpec.valueText);
    const rdwVal = normalizeApproval(snapshot.typeApprovalNumber);
    if (pageVal === rdwVal) score += 4;
    else if (pageVal.startsWith(rdwVal) || rdwVal.startsWith(pageVal)) score += 2;
  }

  // Signal 3: RDW variant code (e.g. "B5P71") in page text
  // Carbase sometimes lists EU variant/version codes in their technical specs table.
  // These are unique per trim configuration.
  if (snapshot.variant && snapshot.variant.length >= 4) {
    if (rawHtml.includes(snapshot.variant)) score += 8;
  }
  if (snapshot.rdwConfigurationCode && snapshot.rdwConfigurationCode.length >= 4) {
    if (rawHtml.includes(snapshot.rdwConfigurationCode)) score += 8;
  }

  return score;
}

// ---------------------------------------------------------------------------
// Section-aware spec extraction
// ---------------------------------------------------------------------------

function classifySectionContext(text: string): string {
  const t = text.toLowerCase().trim();
  if (t.includes("wltp")) return "wltp";
  if (t.includes("nedc")) return "nedc";
  return t;
}

function extractSpecsFromPage($: cheerio.CheerioAPI, versionUrl: string): EnrichedSpecMap {
  const specs: EnrichedSpecMap = new Map();
  let sectionContext = "";

  function lookupSpecKey(label: string): string | undefined {
    if (sectionContext === "wltp") {
      const k = WLTP_LABEL_MAP[label];
      if (k !== undefined) return k;
    }
    if (sectionContext === "nedc") {
      const k = NEDC_LABEL_MAP[label];
      if (k !== undefined) return k;
    }
    return SPEC_LABEL_MAP[label];
  }

  function addSpec(rawLabel: string, rawValue: string): void {
    const label = normalize(rawLabel);
    const rawV = rawValue.trim();
    const v = normalize(rawV);
    if (!label || !v || SKIP_VALUES.has(v)) return;

    const specKey = lookupSpecKey(label);
    if (!specKey) return;

    if (label === "parkeersensoren") {
      const hasRear = v.includes("achter") || !v.includes("alleen voor");
      const hasFront = v.includes("voor");
      if (hasRear && !specs.has("parking_sensors_rear")) {
        specs.set("parking_sensors_rear", makeSpec(rawV, versionUrl));
      }
      if (hasFront && !specs.has("parking_sensors_front")) {
        specs.set("parking_sensors_front", makeSpec(rawV, versionUrl));
      }
      return;
    }

    if (specs.has(specKey)) return;
    specs.set(specKey, makeSpec(rawV, versionUrl));
  }

  $("h1, h2, h3, h4, h5, h6, dl, table, li").each((_, el) => {
    const $el = $(el);
    const tag = ((el as unknown as { tagName?: string }).tagName ?? "").toLowerCase();

    if (/^h[1-6]$/.test(tag)) {
      const text = $el.text().trim();
      if (text) sectionContext = classifySectionContext(text);
      return;
    }

    if (tag === "dl") {
      const dts = $el.find("dt").toArray();
      const dds = $el.find("dd").toArray();
      dts.forEach((dt, i) => {
        if (dds[i]) addSpec($(dt).text(), $(dds[i]).text());
      });
      return;
    }

    if (tag === "table") {
      $el.find("tr").each((_, tr) => {
        const $tr = $(tr);
        const th = $tr.find("th").first();
        const tds = $tr.find("td").toArray();
        if (th.length && tds.length > 0) {
          addSpec(th.text(), $(tds[0]).text());
        } else if (tds.length >= 2) {
          addSpec($(tds[0]).text(), $(tds[1]).text());
        }
      });
      return;
    }

    if (tag === "li" && $el.closest("table, dl").length === 0) {
      const text = $el.clone().find("ul, ol").remove().end().text();
      const colon = text.indexOf(":");
      if (colon > 0 && colon < text.length - 1) {
        addSpec(text.slice(0, colon), text.slice(colon + 1));
      }
    }
  });

  return specs;
}

function makeSpec(rawValue: string, versionUrl: string) {
  const v = normalize(rawValue);
  const isJa = v.startsWith("ja");
  const isNee = v === "nee";
  return {
    valueText: rawValue,
    valueNumeric: null,
    valueBoolean: isJa ? true : isNee ? false : null,
    verification: "trim_inferred" as const,
    source: "carbase_autoweek",
    listingUrl: versionUrl,
    timesFound: 1,
    conflictCount: 0,
  };
}

// ---------------------------------------------------------------------------
// Public entrypoint
// ---------------------------------------------------------------------------

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const jitter = (min: number, max: number) => min + Math.random() * (max - min);

/** Maximum candidates to deep-score when phase-1 produces ties. */
const MAX_DEEP_CANDIDATES = 5;

/**
 * Combined deep score above which we consider the match confident enough to
 * stop fetching further candidates (avoids unnecessary extra page loads).
 */
const CONFIDENT_DEEP_SCORE = 10;

export async function searchCarbase(
  snapshot: VehicleSnapshot,
): Promise<EnrichedSpecMap> {
  const brandSlug = slugify(snapshot.brand);
  const brandPrefix = snapshot.brand.toLowerCase() + " ";
  const modelNameClean = snapshot.modelName.toLowerCase().startsWith(brandPrefix)
    ? snapshot.modelName.slice(snapshot.brand.length + 1)
    : snapshot.modelName;
  const modelSlug = slugify(modelNameClean);
  const modelUrl = `${BASE}/carbase/${brandSlug}/${modelSlug}/`;

  const fetchOpts = { userAgent: "okhttp/4.12.0" };

  await sleep(jitter(0, 1200));

  let modelHtml = await fetchHtml(modelUrl, fetchOpts);
  if (!modelHtml) return new Map();

  let $model = cheerio.load(modelHtml);
  let versionLinks = extractVersionLinks($model);

  // Fallback: some brands use brand name as model slug (e.g. MINI ONE → /carbase/mini/mini/)
  if (versionLinks.length === 0 && modelSlug !== brandSlug) {
    const fallbackUrl = `${BASE}/carbase/${brandSlug}/${brandSlug}/`;
    const fallbackHtml = await fetchHtml(fallbackUrl, fetchOpts);
    if (fallbackHtml) {
      const $fb = cheerio.load(fallbackHtml);
      const fallbackLinks = extractVersionLinks($fb);
      if (fallbackLinks.length > 0) {
        $model = $fb;
        versionLinks = fallbackLinks;
      }
    }
  }

  if (versionLinks.length === 0) return new Map();

  // ---------------------------------------------------------------------------
  // Phase 1: score all candidates on label + year range signals
  // ---------------------------------------------------------------------------

  const scored: ScoredLink[] = versionLinks
    .map((link) => ({ ...link, score: scoreVersion(link, snapshot) }))
    .sort((a, b) => b.score - a.score);

  const topScore = scored[0].score;

  // Candidates within 1 point of the top score are considered ambiguous
  const eligible = scored.filter((c) => c.score >= Math.max(0, topScore - 1));

  // Fast path: unambiguous winner — nothing within 1 point of top score
  if (eligible.length === 1) {
    await sleep(jitter(400, 1000));
    const html = await fetchHtml(eligible[0].href, fetchOpts);
    if (!html) return new Map();
    return extractSpecsFromPage(cheerio.load(html), eligible[0].href);
  }

  // ---------------------------------------------------------------------------
  // Phase 2: deep-score a diverse set of candidates using page-level signals
  // ---------------------------------------------------------------------------

  const candidates = selectCandidates(eligible, MAX_DEEP_CANDIDATES);

  let bestSpecs: EnrichedSpecMap | null = null;
  let bestTotal = -Infinity;

  for (let i = 0; i < candidates.length; i++) {
    if (i > 0) await sleep(jitter(400, 800));

    const candidate = candidates[i];
    const html = await fetchHtml(candidate.href, fetchOpts);
    if (!html) continue;

    const $ = cheerio.load(html);
    const specs = extractSpecsFromPage($, candidate.href);
    const deepScore = scoreDeep(specs, html, snapshot);
    const total = candidate.score + deepScore;

    if (total > bestTotal) {
      bestTotal = total;
      bestSpecs = specs;
    }

    // Early exit: a confident match was found (exact price or variant code match)
    if (deepScore >= CONFIDENT_DEEP_SCORE) break;
  }

  return bestSpecs ?? new Map();
}
