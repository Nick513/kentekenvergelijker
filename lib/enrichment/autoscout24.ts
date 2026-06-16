import * as cheerio from "cheerio";
import { fetchHtml } from "@/lib/enrichment/fetch-html";
import { extractEquipmentFromText, mergeEnrichedSpecs } from "@/lib/enrichment/keywords";
import type { EnrichedSpecMap, EnrichedSpecValue, ListingEnrichmentResult } from "@/lib/enrichment/types";
import { formatKenteken, normalizeKenteken } from "@/lib/kenteken";

const BASE = "https://www.autoscout24.nl";

/**
 * Exact feature-name → spec key lookup for AutoScout24's structured equipment list.
 *
 * AutoScout24 presents features as discrete labelled items chosen from a fixed
 * vocabulary, so we can match by exact normalised name with high confidence.
 * Entries cover both Dutch and English variants used on the .nl domain.
 * Keep entries sorted by spec key so diffs stay readable.
 */
const FEATURE_MAP: Record<string, string> = {
  // abs
  "abs": "abs",
  "antiblokkeersysteem": "abs",
  // adaptive_cruise_control
  "acc": "adaptive_cruise_control",
  "actieve cruise control": "adaptive_cruise_control",
  "active cruise control": "adaptive_cruise_control",
  "adaptive cruise control": "adaptive_cruise_control",
  "adaptieve cruise control": "adaptive_cruise_control",
  "intelligent cruise control": "adaptive_cruise_control",
  // adaptive_headlights
  "adaptieve koplampen": "adaptive_headlights",
  "dynamische koplampen": "adaptive_headlights",
  "zwenkkoplampen": "adaptive_headlights",
  // adjustable_steering_wheel
  "verstelbaar stuur": "adjustable_steering_wheel",
  "verstelbaar stuurwiel": "adjustable_steering_wheel",
  "höhenverstellbares lenkrad": "adjustable_steering_wheel",
  // air_conditioning
  "airconditioning": "air_conditioning",
  "airco": "air_conditioning",
  "airconditioner": "air_conditioning",
  // alarm
  "alarm": "alarm",
  "inbraakalarm": "alarm",
  "diefstalalarm": "alarm",
  // alloy_wheels
  "alu velgen": "alloy_wheels",
  "aluminium velgen": "alloy_wheels",
  "lichtmetalen velgen": "alloy_wheels",
  "lichtmetalen wielen": "alloy_wheels",
  // android_auto
  "android auto": "android_auto",
  // apple_carplay
  "apple carplay": "apple_carplay",
  "carplay": "apple_carplay",
  // audio_system
  "audio installatie": "audio_system",
  "audioinstallatie": "audio_system",
  "geluidsinstallatie": "audio_system",
  "radio": "audio_system",
  "soundsystem": "audio_system",
  // auto_dimming_mirrors
  "auto dimmende buitenspiegels": "auto_dimming_mirrors",
  "automatisch dimmende buitenspiegels": "auto_dimming_mirrors",
  "electrochrome buitenspiegels": "auto_dimming_mirrors",
  // auto_dimming_rearview_mirror
  "auto dimmende binnenspiegel": "auto_dimming_rearview_mirror",
  "automatisch dimmende binnenspiegel": "auto_dimming_rearview_mirror",
  "binnenspiegel automatisch dimmend": "auto_dimming_rearview_mirror",
  "electrochrome binnenspiegel": "auto_dimming_rearview_mirror",
  // automatic_headlights
  "automatisch inschakelende verlichting": "automatic_headlights",
  "lichtsensor": "automatic_headlights",
  "licht sensor": "automatic_headlights",
  // autonomous_emergency_braking
  "aeb": "autonomous_emergency_braking",
  "automatische noodremassistent": "autonomous_emergency_braking",
  "autonomous emergency braking": "autonomous_emergency_braking",
  "autonoom noodsysteem": "autonomous_emergency_braking",
  "noodremassistent": "autonomous_emergency_braking",
  // blind_spot_monitor
  "blind spot": "blind_spot_monitor",
  "blind spot assistent": "blind_spot_monitor",
  "blind-spot": "blind_spot_monitor",
  "dodehoek assistent": "blind_spot_monitor",
  "dodehoekassistent": "blind_spot_monitor",
  "dodehoekdetectie": "blind_spot_monitor",
  "side assist": "blind_spot_monitor",
  // bluetooth
  "bluetooth": "bluetooth",
  "bluetooth handsfree": "bluetooth",
  "handsfree": "bluetooth",
  "hands-free": "bluetooth",
  "hands free": "bluetooth",
  // brake_assist
  "rem assistent": "brake_assist",
  "remassistent": "brake_assist",
  // center_armrest
  "armsteun": "center_armrest",
  "middenarmsteun": "center_armrest",
  // central_locking
  "afstandsbediening": "central_locking",
  "centrale deurvergrendeling": "central_locking",
  "centrale deurvergrendeling met afstandsbediening": "central_locking",
  "centrale vergrendeling": "central_locking",
  // color_matched_bumpers
  "meegespoten bumpers": "color_matched_bumpers",
  "meegespoten bumper": "color_matched_bumpers",
  // cross_traffic_warning
  "cross traffic warning": "cross_traffic_warning",
  "kruisend verkeer waarschuwing": "cross_traffic_warning",
  "rear cross traffic alert": "cross_traffic_warning",
  // cruise_control
  "cruise control": "cruise_control",
  "cruise-control": "cruise_control",
  "snelheidsregelaar": "cruise_control",
  // curtain_airbags
  "curtain airbags": "curtain_airbags",
  "gordijn airbags": "curtain_airbags",
  "hoofd airbag": "curtain_airbags",
  "hoofd/gordijnairbags": "curtain_airbags",
  "hoofdairbags": "curtain_airbags",
  // dab_radio
  "dab radio": "dab_radio",
  "dab+": "dab_radio",
  "digitale radio": "dab_radio",
  "digitale radio (dab+)": "dab_radio",
  // digital_instrument_cluster
  "digital cockpit": "digital_instrument_cluster",
  "digitaal instrumentarium": "digital_instrument_cluster",
  "digitale instrumenten": "digital_instrument_cluster",
  "digitale meters": "digital_instrument_cluster",
  "virtual cockpit": "digital_instrument_cluster",
  // driver_airbag
  "airbag bestuurder": "driver_airbag",
  "bestuurders airbag": "driver_airbag",
  "stuurwiel airbag": "driver_airbag",
  // dual_zone_climate_control
  "2-zone airco": "dual_zone_climate_control",
  "2-zone klimaatregeling": "dual_zone_climate_control",
  "3-zone klimaatregeling": "dual_zone_climate_control",
  "automatische klimaatregeling": "dual_zone_climate_control",
  "dual zone klimaatregeling": "dual_zone_climate_control",
  "klimaatregeling": "dual_zone_climate_control",
  // electric_parking_brake
  "elektrische handrem": "electric_parking_brake",
  "elektrische parkeerrem": "electric_parking_brake",
  "elektronische parkeerrem": "electric_parking_brake",
  // electric_seats
  "elektrisch verstelbare stoelen": "electric_seats",
  "elektrische stoelverstelling": "electric_seats",
  "memory stoelen": "electric_seats",
  "memory stoel": "electric_seats",
  // electric_tailgate
  "elektrische achterklep": "electric_tailgate",
  "elektrische kofferklep": "electric_tailgate",
  "hands free achterklep": "electric_tailgate",
  "hands-free achterklep": "electric_tailgate",
  "power tailgate": "electric_tailgate",
  // electric_windows
  "elektrisch bedienbare ramen": "electric_windows",
  "elektrische ramen": "electric_windows",
  "elektrisch verstelbare ramen": "electric_windows",
  // emergency_call
  "ecall": "emergency_call",
  "emergency call": "emergency_call",
  "sos noodoproep": "emergency_call",
  // fatigue_detection
  "driver alert": "fatigue_detection",
  "vermoeidheidsdetectie": "fatigue_detection",
  "vermoeidheidssensor": "fatigue_detection",
  // fog_lights
  "mistlampen": "fog_lights",
  "mistlampen voor": "fog_lights",
  "voormistlichten": "fog_lights",
  // folding_mirrors
  "elektrisch inklapbare buitenspiegels": "folding_mirrors",
  "inklapbare buitenspiegels": "folding_mirrors",
  "inklapbare spiegels": "folding_mirrors",
  // folding_rear_seats
  "neerklapbare achterbank": "folding_rear_seats",
  "neerklapbare achterstoelen": "folding_rear_seats",
  "verstelbare achterbank": "folding_rear_seats",
  // head_up_display
  "head up display": "head_up_display",
  "head-up display": "head_up_display",
  "heads-up display": "head_up_display",
  "hud": "head_up_display",
  "windscherm display": "head_up_display",
  // headlight_washers
  "koplampsproeiers": "headlight_washers",
  "koplampreiniging": "headlight_washers",
  "wassysteem voor koplampen": "headlight_washers",
  // heated_seats
  "stoelverwarming": "heated_seats",
  "verwarmde stoelen": "heated_seats",
  "verwarmde voorstoelen": "heated_seats",
  // heated_steering_wheel
  "stuurverwarming": "heated_steering_wheel",
  "verwarmd stuurwiel": "heated_steering_wheel",
  "verwarmbaar stuurwiel": "heated_steering_wheel",
  // heated_windscreen
  "heated windscreen": "heated_windscreen",
  "verwarmde voorruit": "heated_windscreen",
  "verwarmd windscherm": "heated_windscreen",
  // high_beam_assist
  "automatische grootlichtregeling": "high_beam_assist",
  "grootlicht assistent": "high_beam_assist",
  "grootlichtassistent": "high_beam_assist",
  "high beam assist": "high_beam_assist",
  // hill_assist
  "bergopstart hulp": "hill_assist",
  "helling start assistent": "hill_assist",
  "hill assist": "hill_assist",
  "hill hold": "hill_assist",
  "hill start assist": "hill_assist",
  "hill-hold control": "hill_assist",
  "hillholder": "hill_assist",
  // isofix
  "isofix": "isofix",
  "isofix bevestiging": "isofix",
  "isofix beugel": "isofix",
  // keyless_entry
  "keyless": "keyless_entry",
  "keyless entry": "keyless_entry",
  "keyless go": "keyless_entry",
  "keyless start": "keyless_entry",
  "sleutelloos starten": "keyless_entry",
  // lane_assist
  "lane assist": "lane_assist",
  "rijstrookassistent": "lane_assist",
  "rijstrookbewaking": "lane_assist",
  "rijstrookwaarschuwing": "lane_assist",
  // lane_keep_assist
  "lane centering": "lane_keep_assist",
  "lane keeping assist": "lane_keep_assist",
  "lane-keep assist": "lane_keep_assist",
  "rijbaanwisseling assistent": "lane_keep_assist",
  "rijstrook volg assistent": "lane_keep_assist",
  // leather_steering_wheel
  "leer bekleed stuurwiel": "leather_steering_wheel",
  "lederen stuur": "leather_steering_wheel",
  "lederen stuurwiel": "leather_steering_wheel",
  "met leer bekleed stuur": "leather_steering_wheel",
  // leather_upholstery
  "alcantara": "leather_upholstery",
  "leder interieur": "leather_upholstery",
  "lederen bekleding": "leather_upholstery",
  "lederen stoelen": "leather_upholstery",
  "nappa leder": "leather_upholstery",
  // led_headlights
  "full led": "led_headlights",
  "led dagrijverlichting": "led_headlights",
  "led koplampen": "led_headlights",
  "led verlichting": "led_headlights",
  "led-koplampen": "led_headlights",
  "matrix led": "led_headlights",
  "matrix-led": "led_headlights",
  "laser licht": "led_headlights",
  // led_taillights
  "led achterlichten": "led_taillights",
  "led achterlicht": "led_taillights",
  // limited_slip_differential
  "sperdifferentieel": "limited_slip_differential",
  "lsd": "limited_slip_differential",
  // metallic_paint
  "metallic lak": "metallic_paint",
  "metallic kleur": "metallic_paint",
  // navigation
  "navigatie": "navigation",
  "navigatiesysteem": "navigation",
  "gps navigatie": "navigation",
  "ingebouwde navigatie": "navigation",
  // night_vision
  "nachtzicht": "night_vision",
  "night vision": "night_vision",
  // paddle_shifters
  "flippers": "paddle_shifters",
  "paddle shifters": "paddle_shifters",
  "stuurschakeling": "paddle_shifters",
  // panoramic_roof
  "glasdak panorama": "panoramic_roof",
  "open panoramadak": "panoramic_roof",
  "panorama dak": "panoramic_roof",
  "panoramadak": "panoramic_roof",
  "panoramaglasdak": "panoramic_roof",
  // parking_assist
  "park assist": "parking_assist",
  "parkeerassistent": "parking_assist",
  "parkeerhulp": "parking_assist",
  "parking assist": "parking_assist",
  "ultrasoon parkeren": "parking_assist",
  // parking_camera
  "360 camera": "parking_camera",
  "360 graden camera": "parking_camera",
  "achteruitrijcamera": "parking_camera",
  "parkeercamera": "parking_camera",
  "parkeerhulp met camera": "parking_camera",
  "surround view camera": "parking_camera",
  "surround view": "parking_camera",
  // parking_sensors_front
  "parkeerhulp voor": "parking_sensors_front",
  "parkeersensoren voor": "parking_sensors_front",
  "parkeersensor voor": "parking_sensors_front",
  "pdc voor": "parking_sensors_front",
  "ultrasonische sensoren voor": "parking_sensors_front",
  // parking_sensors_rear
  "parkeerhulp achter": "parking_sensors_rear",
  "parkeersensoren achter": "parking_sensors_rear",
  "parkeersensor achter": "parking_sensors_rear",
  "pdc": "parking_sensors_rear",
  "pdc achter": "parking_sensors_rear",
  "ultrasonische sensoren achter": "parking_sensors_rear",
  // passenger_airbag
  "airbag passagier": "passenger_airbag",
  "passagier airbag": "passenger_airbag",
  // power_mirrors
  "elektrisch verstelbare buitenspiegels": "power_mirrors",
  "elektrische buitenspiegels": "power_mirrors",
  "elektrisch buitenspiegels": "power_mirrors",
  // power_steering
  "servo stuur": "power_steering",
  "stuurbekrachtiging": "power_steering",
  // precrash_system
  "pre-crash systeem": "precrash_system",
  "precrash systeem": "precrash_system",
  // privacy_rear_glass
  "getint glas achter": "privacy_rear_glass",
  "privacy glas": "privacy_rear_glass",
  "privacy glas achter": "privacy_rear_glass",
  // rain_sensor
  "regen sensor": "rain_sensor",
  "regensensor": "rain_sensor",
  "regensensoren": "rain_sensor",
  "regendetectie": "rain_sensor",
  // roof_rails
  "dak rails": "roof_rails",
  "dakreling": "roof_rails",
  "dakrails": "roof_rails",
  "roof rails": "roof_rails",
  // side_airbags
  "side airbags": "side_airbags",
  "zij airbags": "side_airbags",
  "zij-airbags": "side_airbags",
  "zijairbags": "side_airbags",
  // sport_seats
  "sport stoelen": "sport_seats",
  "sportstoelen": "sport_seats",
  "sportzetels": "sport_seats",
  // stability_control
  "dynamische stabiliteitsregeling": "stability_control",
  "esc": "stability_control",
  "esp": "stability_control",
  "electronic stability control": "stability_control",
  "electronic stability program": "stability_control",
  "stabiliteitsregeling": "stability_control",
  "stabiliteitsprogramma": "stability_control",
  // start_button
  "startknop": "start_button",
  "start knop": "start_button",
  "push start": "start_button",
  "drukknopstart": "start_button",
  // start_stop_system
  "start stop": "start_stop_system",
  "start-stop": "start_stop_system",
  "start/stop": "start_stop_system",
  "start/stop-systeem": "start_stop_system",
  // steering_wheel_audio_controls
  "multifunctioneel stuurwiel": "steering_wheel_audio_controls",
  "stuurwiel bediening": "steering_wheel_audio_controls",
  "stuurwielbediening": "steering_wheel_audio_controls",
  // sunroof
  "glazen dak": "sunroof",
  "open dak": "sunroof",
  "schuif-kanteldak": "sunroof",
  "schuifdak": "sunroof",
  "zonnedak": "sunroof",
  // tinted_glass
  "getint glas": "tinted_glass",
  "getinte ramen": "tinted_glass",
  "privacy glas voor": "tinted_glass",
  // tire_pressure_monitor
  "band drukcontrole": "tire_pressure_monitor",
  "bandenspanningscontrole": "tire_pressure_monitor",
  "bandenspanningsensor": "tire_pressure_monitor",
  "tpms": "tire_pressure_monitor",
  "tyre pressure": "tire_pressure_monitor",
  // tow_hitch
  "afneembare trekhaak": "tow_hitch",
  "trekhaak": "tow_hitch",
  "vaste trekhaak": "tow_hitch",
  "zwenkbare trekhaak": "tow_hitch",
  // traction_control
  "asr": "traction_control",
  "tractie controle": "traction_control",
  "tractiecontrole": "traction_control",
  "traction control": "traction_control",
  // traffic_sign_recognition
  "borden herkenning": "traffic_sign_recognition",
  "snelheidsbordenherkenning": "traffic_sign_recognition",
  "traffic sign recognition": "traffic_sign_recognition",
  "verkeersbordherkenning": "traffic_sign_recognition",
  // trip_computer
  "boordcomputer": "trip_computer",
  "ritcomputer": "trip_computer",
  "trip computer": "trip_computer",
  // turn_signal_mirrors
  "knipperlicht in buitenspiegel": "turn_signal_mirrors",
  "richtingaanwijzer in buitenspiegel": "turn_signal_mirrors",
  "richtingaanwijzer in buitenspiegels": "turn_signal_mirrors",
  // wireless_phone_charging
  "draadloos laden": "wireless_phone_charging",
  "draadloos opladen": "wireless_phone_charging",
  "inductief laden": "wireless_phone_charging",
  "inductief opladen": "wireless_phone_charging",
  "qi lader": "wireless_phone_charging",
  "wireless charging": "wireless_phone_charging",
  // xenon_headlights
  "bi xenon": "xenon_headlights",
  "bi-xenon": "xenon_headlights",
  "bi-xenon koplampen": "xenon_headlights",
  "hid koplampen": "xenon_headlights",
  "xenon": "xenon_headlights",
  "xenon koplampen": "xenon_headlights",
  "xenon verlichting": "xenon_headlights",
};

/** All spec keys that appear in the feature map — used for negative evidence. */
const COVERED_SPEC_KEYS = new Set(Object.values(FEATURE_MAP));

function extractVehicleJsonLd(html: string): Record<string, unknown> | null {
  const $ = cheerio.load(html);
  let result: Record<string, unknown> | null = null;

  $('script[type="application/ld+json"]').each((_, element) => {
    if (result) return;
    const raw = $(element).contents().text();
    if (!raw) return;
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      return;
    }
    const nodes = Array.isArray(data) ? data : [data];
    for (const node of nodes) {
      if (!node || typeof node !== "object") continue;
      const record = node as Record<string, unknown>;
      const types = (Array.isArray(record["@type"]) ? record["@type"] : [record["@type"]]) as string[];
      if (types.includes("Car")) {
        result = record;
        return;
      }
    }
  });

  return result;
}

function extractMileageKm(vehicle: Record<string, unknown>): number | null {
  const raw = vehicle.mileageFromOdometer;
  if (typeof raw === "number") return raw > 0 && raw < 2_000_000 ? Math.round(raw) : null;
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    const val = typeof obj.value === "number"
      ? obj.value
      : parseFloat(String(obj.value ?? "").replace(/\./g, "").replace(",", "."));
    if (!isNaN(val) && val > 0 && val < 2_000_000) {
      const unit = (obj.unitCode as string | undefined)?.toUpperCase();
      return Math.round(unit === "SMI" ? val * 1.60934 : val);
    }
  }
  return null;
}

function extractPriceEur(vehicle: Record<string, unknown>): number | null {
  const offers = vehicle.offers as Record<string, unknown> | undefined;
  if (!offers) return null;
  const currency = offers.priceCurrency as string | undefined;
  if (currency && currency.toUpperCase() !== "EUR") return null;
  const raw = offers.price;
  let price: number;
  if (typeof raw === "number") {
    price = raw;
  } else if (typeof raw === "string") {
    price = parseFloat(raw.replace(/\./g, "").replace(",", "."));
  } else {
    return null;
  }
  return !isNaN(price) && price > 0 && price < 10_000_000 ? Math.round(price) : null;
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function plateVariants(licensePlate: string): string[] {
  const n = normalizeKenteken(licensePlate);
  const f = formatKenteken(n);
  return [...new Set([n, f, n.toLowerCase(), f.toLowerCase()])];
}

function containsPlate(text: string, variants: string[]): boolean {
  const h = text.replace(/[-\s]/g, "").toLowerCase();
  return variants.some((v) => h.includes(v.replace(/[-\s]/g, "").toLowerCase()));
}

function findListingUrl(html: string, variants: string[]): string | null {
  const $ = cheerio.load(html);
  let found: string | null = null;

  $("a[href]").each((_, el) => {
    if (found) return;
    const href = $(el).attr("href") ?? "";
    const text = $(el).text();
    if (!containsPlate(`${href} ${text}`, variants)) return;
    if (
      href.includes("/auto/") ||
      href.includes("/voertuig/") ||
      href.includes("/listing/") ||
      (href.includes("autoscout24") && href.split("/").length > 5)
    ) {
      found = href.startsWith("http") ? href : `${BASE}${href}`;
    }
  });

  return found;
}

/**
 * Ordered list of selectors for AS24's equipment/features section.
 * Tried in sequence; the first one that yields items wins.
 */
const FEATURE_CONTAINER_SELECTORS = [
  '[data-cy="features-list"]',
  '[data-testid="vehicle-details-features"]',
  '[data-testid="features"]',
  '[class*="FeaturesList"]',
  '[class*="features-list"]',
  '[class*="EquipmentList"]',
  '[class*="equipment-list"]',
];

/**
 * Extract equipment items from the detail page.
 * Targets AS24's features section first; falls back to a full-page scan with
 * navigation/chrome stripped so sidebar filters don't pollute the result.
 */
function extractStructuredItems(html: string): string[] {
  const $ = cheerio.load(html);
  const items: string[] = [];

  function collectLiText(root: ReturnType<typeof $>): void {
    root.find("li").each((_, el) => {
      // Nav-style items have a direct <a> child — skip them.
      if ($(el).children("a").length > 0) return;
      const text = $(el).clone().children().remove().end().text().trim();
      if (text && text.length < 80) items.push(text);
    });
  }

  // 1. Try targeted containers — any hit wins immediately.
  for (const sel of FEATURE_CONTAINER_SELECTORS) {
    const container = $(sel);
    if (container.length > 0) {
      collectLiText(container);
      if (items.length > 0) return items;
    }
  }

  // 2. Fallback: remove boilerplate then scan the remaining <li> elements.
  $(
    "nav, header, footer, aside, " +
    "[role='navigation'], [role='menu'], [role='menubar'], " +
    "[role='banner'], [role='complementary'], " +
    "script, style",
  ).remove();

  $("li").each((_, el) => {
    if ($(el).children("a").length > 0) return;
    const text = $(el).clone().children().remove().end().text().trim();
    if (text && text.length < 80) items.push(text);
  });

  return items;
}

/**
 * Extract seller description / free-text notes from the detail page.
 * Targeted selectors are tried first; the fallback strips navigation before
 * scanning <p> elements so menu prose doesn't leak in.
 */
function extractDescriptionText(html: string): string {
  const $ = cheerio.load(html);
  const parts: string[] = [];

  const descSelectors = [
    '[data-testid="description-text"]',
    '[data-testid="seller-notes"]',
    '[data-testid="description"]',
    '[class*="description"] p',
    '[class*="Description"] p',
    '[class*="VehicleDescription"] p',
    "#description p",
    ".description p",
  ];

  for (const sel of descSelectors) {
    $(sel).each((_, el) => {
      const t = $(el).text().trim();
      if (t) parts.push(t);
    });
    if (parts.length > 0) break;
  }

  if (parts.length === 0) {
    $("nav, header, footer, aside, [role='navigation'], script, style").remove();
    $("p").each((_, el) => {
      const t = $(el).text().trim();
      if (t.length > 30) parts.push(t);
    });
  }

  return parts.join(" ");
}

/**
 * Map structured feature items to spec values.
 * Exact-matches normalised item text against FEATURE_MAP → listing_claim_structured.
 */
function buildStructuredSpecs(
  items: string[],
  listingUrl: string | null,
): EnrichedSpecMap {
  const specs: EnrichedSpecMap = new Map();

  for (const item of items) {
    const specKey = FEATURE_MAP[normalize(item)];
    if (specKey) {
      specs.set(specKey, {
        valueText: null,
        valueNumeric: null,
        valueBoolean: true,
        verification: "listing_claim_structured",
        source: "listing_autoscout24",
        listingUrl,
        timesFound: 1,
        conflictCount: 0,
      } satisfies EnrichedSpecValue);
    }
  }

  return specs;
}

/**
 * When we found a non-trivial number of structured features, assume the list is
 * complete: any covered spec key that is absent was deliberately not checked →
 * write it as false with listing_claim_structured priority.
 *
 * This is the mechanism that kills catalog false positives like "adaptive cruise
 * control" being inferred for a trim that only has regular cruise control.
 *
 * Description-found positives (listing_claim=2) will NOT override this (priority 3),
 * which is intentional — the structured checkbox list is more authoritative than
 * prose text for binary equipment questions.
 */
function applyNegativeEvidence(
  specs: EnrichedSpecMap,
  listingUrl: string | null,
): void {
  for (const specKey of COVERED_SPEC_KEYS) {
    if (!specs.has(specKey)) {
      specs.set(specKey, {
        valueText: null,
        valueNumeric: null,
        valueBoolean: false,
        verification: "listing_claim_structured",
        source: "listing_autoscout24",
        listingUrl,
        timesFound: 1,
        conflictCount: 0,
      });
    }
  }
}

export async function searchAutoScout24(
  licensePlate: string,
): Promise<ListingEnrichmentResult> {
  const normalized = normalizeKenteken(licensePlate);
  const variants = plateVariants(licensePlate);

  const searchUrls = [
    `${BASE}/lst?search=${normalized}`,
    `${BASE}/lst?q=${normalized}`,
    `${BASE}/zoeken?kenteken=${normalized}`,
  ];

  let listingUrl: string | null = null;
  let searchUrl: string | null = null;

  for (const url of searchUrls) {
    const html = await fetchHtml(url, { referer: "https://www.google.nl/" });
    if (!html || !containsPlate(html, variants)) continue;
    listingUrl = findListingUrl(html, variants);
    if (listingUrl) { searchUrl = url; break; }
  }

  if (!listingUrl) return { specs: new Map(), mileageKm: null, askingPriceEur: null };

  const detailHtml = await fetchHtml(listingUrl, { referer: searchUrl ?? BASE });
  if (!detailHtml) return { specs: new Map(), mileageKm: null, askingPriceEur: null };

  // --- Market data from JSON-LD ---
  const vehicleJsonLd = extractVehicleJsonLd(detailHtml);
  const mileageKm = vehicleJsonLd ? extractMileageKm(vehicleJsonLd) : null;
  const askingPriceEur = vehicleJsonLd ? extractPriceEur(vehicleJsonLd) : null;

  // --- Structured feature list (highest confidence) ---
  const structuredItems = extractStructuredItems(detailHtml);
  const structuredSpecs = buildStructuredSpecs(structuredItems, listingUrl);

  if (structuredSpecs.size >= 3) {
    applyNegativeEvidence(structuredSpecs, listingUrl);
  }

  // --- Description text (lower confidence, adds positive signals only) ---
  // Uses the same keyword list as Gaspedaal/Autotrack so phrasing variants are covered.
  // listing_claim (priority 2) never overrides listing_claim_structured (priority 3),
  // so description positives cannot resurrect a spec that negative evidence killed.
  const descriptionText = extractDescriptionText(detailHtml);
  const descriptionSpecs = descriptionText
    ? extractEquipmentFromText(descriptionText, "listing_autoscout24_desc", listingUrl)
    : (new Map() as EnrichedSpecMap);

  // Structured wins on conflict; description fills in any gaps.
  const specs = mergeEnrichedSpecs(structuredSpecs, descriptionSpecs);
  return { specs, mileageKm, askingPriceEur };
}
