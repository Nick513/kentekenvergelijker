import * as cheerio from "cheerio";
import { fetchHtml } from "@/lib/enrichment/fetch-html";
import type { EnrichedSpecMap } from "@/lib/enrichment/types";
import type { VehicleSnapshot } from "@/lib/rdw/types";

const BASE = "https://www.autoweek.nl";

// ---------------------------------------------------------------------------
// Label maps: Dutch carbase label → spec key
// The three maps handle context where the same label means different things
// across sections (e.g. "verbruik gecombineerd" under NEDC vs WLTP).
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

/** Labels inside a NEDC consumption section that would otherwise be ambiguous. */
const NEDC_LABEL_MAP: Record<string, string> = {
  "verbruik gecombineerd": "fuel_consumption_combined_nedc",
  "verbruik binnen bebouwde kom": "fuel_consumption_urban_nedc",
  "verbruik buiten bebouwde kom": "fuel_consumption_extra_urban_nedc",
  "stroomverbruik": "electricity_consumption_nedc",
  "actieradius": "electric_range_nedc",
};

/** Labels inside a WLTP consumption section. */
const WLTP_LABEL_MAP: Record<string, string> = {
  "verbruik gecombineerd": "fuel_consumption_combined_wltp",
  "stroomverbruik": "electricity_consumption_wltp",
  "actieradius": "electric_range_wltp",
};

// Values that indicate data is unavailable — skip them entirely.
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

type VersionLink = { href: string; label: string };

function extractVersionLinks($: cheerio.CheerioAPI, modelPathname: string): VersionLink[] {
  const seen = new Set<string>();
  const links: VersionLink[] = [];

  $("a[href]").each((_, el) => {
    const raw = $(el).attr("href") ?? "";
    const href = raw.startsWith("http") ? raw : `${BASE}${raw}`;
    const label = $(el).text().trim();

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

  if (snapshot.firstRegistrationYear) {
    const y = snapshot.firstRegistrationYear;
    const rangeMatch = norm.match(/(\d{4})-(\d{4})/);
    if (rangeMatch) {
      const from = Number(rangeMatch[1]);
      const to = Number(rangeMatch[2]);
      if (y >= from && y <= to) score += 2;
    }
    if (norm.includes(String(y))) score += 1;
  }

  return score;
}

// ---------------------------------------------------------------------------
// Section-aware spec extraction
// ---------------------------------------------------------------------------

/** Classify a heading text into a section context used for label disambiguation. */
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

    // Parking sensors: one label, potentially two spec keys
    if (label === "parkeersensoren") {
      const hasRear = v.includes("achter") || !v.includes("alleen voor");
      const hasfront = v.includes("voor");
      if (hasRear && !specs.has("parking_sensors_rear")) {
        specs.set("parking_sensors_rear", makeSpec(rawV, versionUrl));
      }
      if (hasfront && !specs.has("parking_sensors_front")) {
        specs.set("parking_sensors_front", makeSpec(rawV, versionUrl));
      }
      return;
    }

    if (specs.has(specKey)) return;
    specs.set(specKey, makeSpec(rawV, versionUrl));
  }

  // Walk elements in document order so section headers update context before specs.
  $("h1, h2, h3, h4, h5, h6, dl, table, li").each((_, el) => {
    const $el = $(el);
    const tag = ((el as unknown as { tagName?: string }).tagName ?? "").toLowerCase();

    // Section headers update context
    if (/^h[1-6]$/.test(tag)) {
      const text = $el.text().trim();
      if (text) sectionContext = classifySectionContext(text);
      return;
    }

    // Definition lists
    if (tag === "dl") {
      const dts = $el.find("dt").toArray();
      const dds = $el.find("dd").toArray();
      dts.forEach((dt, i) => {
        if (dds[i]) addSpec($(dt).text(), $(dds[i]).text());
      });
      return;
    }

    // Tables (process the whole table at once to avoid double-visiting rows)
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

    // List items with colon separator, skipping items nested inside tables/dls
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
