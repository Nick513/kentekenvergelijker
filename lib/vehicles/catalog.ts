import { unstable_cache } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PlateFetchResult, VehicleSnapshot } from "@/lib/rdw/types";

const CACHE_TTL_SECONDS = 3600;
const DISPLACEMENT_TOLERANCE_CC = 80;
const CATALOG_PRICE_TOLERANCE = 2500;
const LIST_PRICE_TOLERANCE = 4000;
/** Fallback when fiscal_list_price is missing; catalogusprijs ≈ rijklaarprijs minus BPM. */
const FISCAL_TO_LIST_RATIO = 0.8203;
/** Below this trim score we refuse to guess uitvoering (show RDW only for catalog gaps). */
const MIN_TRIM_CONFIDENCE_SCORE = 0.3;

/** Never gap-fill these from a fuel sibling; use primary row or live RDW only. */
const ENGINE_BOUND_SPEC_KEYS = new Set([
  "fuel_type",
  "power_kw",
  "co2_emission_g_km",
  "engine_displacement_cc",
  "cylinder_count",
  "electric_range_wltp",
  "electric_consumption_wltp",
  "electric_range_nedc",
  "electricity_consumption_nedc",
  "fuel_consumption_combined_nedc",
  "fuel_consumption_urban_nedc",
  "fuel_consumption_extra_urban_nedc",
  "curb_weight_kg",
  "empty_weight_kg",
  "max_payload",
  "max_permissible_weight",
  "max_front_axle_weight",
  "max_rear_axle_weight",
  "company_car_tax",
  "energy_label",
  "list_price_ready_to_drive",
  "fiscal_list_price",
  "delivery_costs",
  "propulsion_system",
  "max_power_engine",
  "max_torque_engine",
  "max_power_total",
  "max_torque_total",
  "top_speed",
  "acceleration_0_100",
  "transmission",
  "rpm_at_100_kmh",
  "rpm_at_130_kmh",
]);

/** Trim-standard equipment; safe to inherit within the same uitvoering. */
const EQUIPMENT_SPEC_KEYS = new Set([
  "trim_package",
  "adaptive_cruise_control",
  "lane_assist",
  "lane_keep_assist",
  "blind_spot_monitor",
  "traffic_sign_recognition",
  "autonomous_emergency_braking",
  "parking_assist",
  "heated_seats",
  "heated_steering_wheel",
  "leather_upholstery",
  "dual_zone_climate_control",
  "electric_seats",
  "keyless_entry",
  "electric_tailgate",
  "panoramic_roof",
  "sunroof",
  "led_headlights",
  "adaptive_headlights",
  "parking_sensors_front",
  "parking_sensors_rear",
  "parking_camera",
  "tow_hitch",
  "navigation",
  "apple_carplay",
  "android_auto",
  "wireless_phone_charging",
]);

export type CatalogSpecValue = {
  valueText: string | null;
  valueNumeric: number | null;
  valueBoolean: boolean | null;
};

/** Resolved catalog spec values for one plate, keyed by spec_key. */
export type CatalogSpecMap = Map<string, CatalogSpecValue>;

type ConfigurationRow = {
  id: string;
  brand: string;
  model_name: string;
  trim_name: string;
  catalog_key: string;
};

type SpecValueRow = {
  vehicle_configuration_id: string;
  spec_key: string;
  value_text: string | null;
  value_numeric: number | null;
  value_boolean: boolean | null;
};

function normalize(value: string | null | undefined): string {
  return (value ?? "").toLowerCase().trim();
}

function modelsMatch(rdwModel: string, catalogModel: string): boolean {
  const a = normalize(rdwModel);
  const b = normalize(catalogModel);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

function generationFromCatalogKey(catalogKey: string): string | null {
  return catalogKey.split("|")[2] ?? null;
}

function withinGeneration(
  year: number | null,
  generationSlug: string | null,
): boolean {
  if (!year || !generationSlug) return true;

  const plus = generationSlug.match(/^(\d{4})-plus$/);
  if (plus) return year >= Number.parseInt(plus[1], 10);

  const range = generationSlug.match(/^(\d{4})-(\d{4})$/);
  if (range) {
    return (
      year >= Number.parseInt(range[1], 10) && year <= Number.parseInt(range[2], 10)
    );
  }

  return true;
}

function toCatalogValue(row: SpecValueRow): CatalogSpecValue {
  return {
    valueText: row.value_text,
    valueNumeric: row.value_numeric === null ? null : Number(row.value_numeric),
    valueBoolean: row.value_boolean,
  };
}

function isHybridFuel(fuel: string | null | undefined): boolean {
  const normalized = normalize(fuel);
  return normalized.includes("hybride") || normalized.includes("hybrid");
}

function isPetrolFuel(fuel: string | null | undefined): boolean {
  const normalized = normalize(fuel);
  return normalized.includes("benzine") && !normalized.includes("hybride");
}

function trimSlugFromCatalogKey(catalogKey: string): string | null {
  return catalogKey.split("|")[3] ?? null;
}

function trimSlugFromModelName(modelName: string): string | null {
  const normalized = normalize(modelName);
  const tokens: [string, string][] = [
    ["premium sky", "premium-sky"],
    ["premium", "premium"],
    ["comfort smart", "comfort-smart"],
    ["comfort", "comfort"],
    ["n line", "n-line"],
    ["i-motion", "i-motion"],
  ];

  for (const [phrase, slug] of tokens) {
    if (normalized.includes(phrase)) {
      return slug;
    }
  }

  return null;
}

function engineSlugFromCatalogKey(catalogKey: string): string {
  return catalogKey.split("|")[4] ?? "";
}

function isHybridEngineSlug(engineSlug: string): boolean {
  const normalized = normalize(engineSlug);
  return (
    normalized.includes("hybride") ||
    normalized.includes("hybrid") ||
    normalized.includes("mhev") ||
    normalized.includes("phev")
  );
}

function isHybridCatalogRow(
  configId: string,
  fuelById: Map<string, string>,
  catalogKeyById: Map<string, string>,
): boolean {
  const fuel = fuelById.get(configId);
  if (fuel && isHybridFuel(fuel)) {
    return true;
  }
  return isHybridEngineSlug(engineSlugFromCatalogKey(catalogKeyById.get(configId) ?? ""));
}

function isPetrolCatalogRow(
  configId: string,
  fuelById: Map<string, string>,
  catalogKeyById: Map<string, string>,
): boolean {
  if (isHybridCatalogRow(configId, fuelById, catalogKeyById)) {
    return false;
  }
  const fuel = fuelById.get(configId);
  if (fuel && isPetrolFuel(fuel)) {
    return true;
  }
  const engineSlug = normalize(engineSlugFromCatalogKey(catalogKeyById.get(configId) ?? ""));
  return engineSlug.includes("benzine");
}

function catalogKeyByIdFromMatches(
  modelMatches: ConfigurationRow[],
): Map<string, string> {
  return new Map(modelMatches.map((row) => [row.id, row.catalog_key]));
}

function pickPrimaryConfigId(
  configIds: string[],
  fuelType: string | null,
  fuelById: Map<string, string>,
  catalogKeyById: Map<string, string>,
): string | null {
  if (isHybridFuel(fuelType)) {
    const hybrid = configIds.find((id) =>
      isHybridCatalogRow(id, fuelById, catalogKeyById),
    );
    if (hybrid) {
      return hybrid;
    }
  }

  const petrol = configIds.find((id) =>
    isPetrolCatalogRow(id, fuelById, catalogKeyById),
  );
  return petrol ?? configIds[0] ?? null;
}

/** Brochure prices often sit on the petrol sibling; use it when the hybrid row has no price. */
function pickPricingConfigId(
  configIds: string[],
  fuelType: string | null,
  fuelById: Map<string, string>,
  catalogKeyById: Map<string, string>,
  specRows: SpecValueRow[],
  pricingCandidateIds?: string[],
): string | null {
  const pricingPool = pricingCandidateIds ?? configIds;
  const primaryId = pickPrimaryConfigId(
    configIds,
    fuelType,
    fuelById,
    catalogKeyById,
  );
  if (!primaryId) {
    return null;
  }

  const hasPrice =
    getNumericSpec(primaryId, "fiscal_list_price", specRows) !== null ||
    getNumericSpec(primaryId, "list_price_ready_to_drive", specRows) !== null;

  if (hasPrice) {
    return primaryId;
  }

  const petrolSibling = pricingPool.find((id) =>
    isPetrolCatalogRow(id, fuelById, catalogKeyById),
  );
  return petrolSibling ?? primaryId;
}

function pricingPoolForTrim(
  trimSlug: string | null,
  modelMatches: ConfigurationRow[],
): string[] {
  if (!trimSlug) {
    return [];
  }
  return modelMatches
    .filter((row) => trimSlugFromCatalogKey(row.catalog_key) === trimSlug)
    .map((row) => row.id);
}

function getNumericSpec(
  configId: string,
  specKey: string,
  specRows: SpecValueRow[],
): number | null {
  const row = specRows.find(
    (entry) =>
      entry.vehicle_configuration_id === configId && entry.spec_key === specKey,
  );
  if (row?.value_numeric === null || row?.value_numeric === undefined) {
    return null;
  }
  return Number(row.value_numeric);
}

function scoreTrimForSnapshot(
  snapshot: VehicleSnapshot,
  configIds: string[],
  modelMatches: ConfigurationRow[],
  specRows: SpecValueRow[],
  fuelById: Map<string, string>,
  catalogKeyById: Map<string, string>,
): number {
  const trimSlug =
    configIds.length > 0
      ? trimSlugFromCatalogKey(catalogKeyById.get(configIds[0]) ?? "")
      : null;
  const pricingPool = pricingPoolForTrim(trimSlug, modelMatches);

  const pricingId = pickPricingConfigId(
    configIds,
    snapshot.fuelType,
    fuelById,
    catalogKeyById,
    specRows,
    pricingPool.length > 0 ? pricingPool : configIds,
  );
  const primaryId = pickPrimaryConfigId(
    configIds,
    snapshot.fuelType,
    fuelById,
    catalogKeyById,
  );
  if (!pricingId && !primaryId) {
    return 0;
  }

  let score = 0;

  if (snapshot.catalogPrice !== null && pricingId) {
    const fiscal = getNumericSpec(pricingId, "fiscal_list_price", specRows);
    const listPrice = getNumericSpec(
      pricingId,
      "list_price_ready_to_drive",
      specRows,
    );

    if (fiscal !== null) {
      const diff = Math.abs(snapshot.catalogPrice - fiscal);
      score += Math.max(0, 1 - diff / CATALOG_PRICE_TOLERANCE) * 2;
    } else if (listPrice !== null) {
      const estimatedList = snapshot.catalogPrice / FISCAL_TO_LIST_RATIO;
      const diff = Math.abs(estimatedList - listPrice);
      score += Math.max(0, 1 - diff / LIST_PRICE_TOLERANCE) * 1.5;
    }
  }

  const specSourceId = primaryId ?? pricingId;
  if (!specSourceId) {
    return score;
  }

  if (snapshot.powerKw !== null) {
    const power = getNumericSpec(specSourceId, "power_kw", specRows);
    if (power !== null && Math.abs(power - snapshot.powerKw) <= 4) {
      score += 0.5;
    }
  }

  if (snapshot.co2EmissionGKm !== null) {
    const co2 = getNumericSpec(specSourceId, "co2_emission_g_km", specRows);
    if (co2 !== null && Math.abs(co2 - snapshot.co2EmissionGKm) <= 15) {
      score += 0.4;
    }
  }

  if (snapshot.curbWeightKg !== null) {
    const weight = getNumericSpec(specSourceId, "curb_weight_kg", specRows);
    if (weight !== null && Math.abs(weight - snapshot.curbWeightKg) <= 50) {
      score += 0.3;
    }
  }

  return score;
}

function groupIdsByTrim(
  configIds: string[],
  modelMatches: ConfigurationRow[],
): Map<string, string[]> {
  const groups = new Map<string, string[]>();

  for (const id of configIds) {
    const row = modelMatches.find((entry) => entry.id === id);
    const trimSlug = row ? trimSlugFromCatalogKey(row.catalog_key) : null;
    if (!trimSlug) {
      continue;
    }

    const list = groups.get(trimSlug) ?? [];
    list.push(id);
    groups.set(trimSlug, list);
  }

  return groups;
}

function scoreConfigurationForSnapshot(
  snapshot: VehicleSnapshot,
  configId: string,
  modelMatches: ConfigurationRow[],
  specRows: SpecValueRow[],
  fuelById: Map<string, string>,
  catalogKeyById: Map<string, string>,
): number {
  const trimSlug = trimSlugFromCatalogKey(catalogKeyById.get(configId) ?? "");
  const pricingPool = pricingPoolForTrim(trimSlug, modelMatches);

  const pricingId = pickPricingConfigId(
    [configId],
    snapshot.fuelType,
    fuelById,
    catalogKeyById,
    specRows,
    pricingPool.length > 0 ? pricingPool : [configId],
  );

  let score = 0;

  if (snapshot.catalogPrice !== null && pricingId) {
    const fiscal = getNumericSpec(pricingId, "fiscal_list_price", specRows);
    const listPrice = getNumericSpec(
      pricingId,
      "list_price_ready_to_drive",
      specRows,
    );

    if (fiscal !== null) {
      const diff = Math.abs(snapshot.catalogPrice - fiscal);
      score += Math.max(0, 1 - diff / CATALOG_PRICE_TOLERANCE) * 2;
    } else if (listPrice !== null) {
      const estimatedList = snapshot.catalogPrice / FISCAL_TO_LIST_RATIO;
      const diff = Math.abs(estimatedList - listPrice);
      score += Math.max(0, 1 - diff / LIST_PRICE_TOLERANCE) * 1.5;
    }
  }

  if (snapshot.powerKw !== null) {
    const power = getNumericSpec(configId, "power_kw", specRows);
    if (power !== null && Math.abs(power - snapshot.powerKw) <= 4) {
      score += 0.5;
    }
  }

  if (snapshot.co2EmissionGKm !== null) {
    const co2 = getNumericSpec(configId, "co2_emission_g_km", specRows);
    if (co2 !== null && Math.abs(co2 - snapshot.co2EmissionGKm) <= 15) {
      score += 0.4;
    }
  }

  if (snapshot.curbWeightKg !== null) {
    const weight = getNumericSpec(configId, "curb_weight_kg", specRows);
    if (weight !== null && Math.abs(weight - snapshot.curbWeightKg) <= 50) {
      score += 0.3;
    }
  }

  return score;
}

/**
 * Narrow candidates to the catalog row that matches this plate's fuel family.
 * Never mixes hybrid + petrol rows: one physical car, one catalog_key.
 */
function filterByExactFuel(
  candidateIds: string[],
  rdwFuel: string | null,
  fuelById: Map<string, string>,
  catalogKeyById: Map<string, string>,
): string[] {
  if (!rdwFuel) return candidateIds;

  const rdw = normalize(rdwFuel);
  const isHybrid = isHybridFuel(rdwFuel);

  if (isHybrid) {
    const hybridMatches = candidateIds.filter((id) =>
      isHybridCatalogRow(id, fuelById, catalogKeyById),
    );
    if (hybridMatches.length > 0) return hybridMatches;
  }

  for (const token of ["benzine", "diesel", "elektrisch", "lpg"]) {
    if (!rdw.includes(token)) continue;
    const matches = candidateIds.filter((id) => {
      if (isHybridCatalogRow(id, fuelById, catalogKeyById)) {
        return false;
      }
      const fuel = fuelById.get(id);
      if (fuel === undefined) {
        const engineSlug = normalize(engineSlugFromCatalogKey(catalogKeyById.get(id) ?? ""));
        return engineSlug.includes(token);
      }
      const normalized = normalize(fuel);
      return normalized.includes(token) && !normalized.includes("hybride");
    });
    if (matches.length > 0) return matches;
  }

  const loose = candidateIds.filter((id) => {
    const fuel = fuelById.get(id);
    return fuel !== undefined && fuelsMatch(rdwFuel, fuel);
  });
  return loose.length > 0 ? loose : candidateIds;
}

function pickExactConfigurationId(
  snapshot: VehicleSnapshot,
  candidateIds: string[],
  modelMatches: ConfigurationRow[],
  specRows: SpecValueRow[],
  fuelById: Map<string, string>,
  catalogKeyById: Map<string, string>,
  trimSlug: string | null,
): string | null {
  let candidates = candidateIds;

  if (trimSlug) {
    const inTrim = candidates.filter((id) => {
      const row = modelMatches.find((entry) => entry.id === id);
      return row && trimSlugFromCatalogKey(row.catalog_key) === trimSlug;
    });
    if (inTrim.length > 0) {
      candidates = inTrim;
    }
  }

  candidates = filterByExactFuel(
    candidates,
    snapshot.fuelType,
    fuelById,
    catalogKeyById,
  );
  if (candidates.length === 0) {
    return null;
  }

  if (candidates.length === 1) {
    return candidates[0];
  }

  let bestId: string | null = null;
  let bestScore = -1;

  for (const id of candidates) {
    const score = scoreConfigurationForSnapshot(
      snapshot,
      id,
      modelMatches,
      specRows,
      fuelById,
      catalogKeyById,
    );
    if (score > bestScore) {
      bestScore = score;
      bestId = id;
    }
  }

  return bestId;
}

function specsFromSingleConfiguration(
  configId: string,
  rows: SpecValueRow[],
): Record<string, CatalogSpecValue> {
  const resolved: Record<string, CatalogSpecValue> = {};
  for (const row of rows) {
    if (row.vehicle_configuration_id !== configId) {
      continue;
    }
    resolved[row.spec_key] = toCatalogValue(row);
  }
  return resolved;
}

function serializeSpecValue(row: SpecValueRow): string {
  return JSON.stringify([
    row.value_text,
    row.value_numeric,
    row.value_boolean,
  ]);
}

function siblingsAgreeOnSpec(
  specKey: string,
  siblingIds: string[],
  rows: SpecValueRow[],
): SpecValueRow | null {
  let agreed: SpecValueRow | null = null;

  for (const configId of siblingIds) {
    const row = rows.find(
      (entry) =>
        entry.vehicle_configuration_id === configId &&
        entry.spec_key === specKey,
    );
    if (!row) {
      continue;
    }

    if (!agreed) {
      agreed = row;
      continue;
    }

    if (serializeSpecValue(row) !== serializeSpecValue(agreed)) {
      return null;
    }
  }

  return agreed;
}

/**
 * Add specs missing on the primary row when we are confident they apply to this
 * plate: trim equipment from siblings, and other trim-level values only when
 * every sibling that has the key agrees.
 */
function fillGapsFromTrimSiblings(
  primaryId: string,
  primarySpecs: Record<string, CatalogSpecValue>,
  rows: SpecValueRow[],
  siblingIds: string[],
): Record<string, CatalogSpecValue> {
  const enriched = { ...primarySpecs };
  const donors = siblingIds.filter((id) => id !== primaryId);
  if (donors.length === 0) {
    return enriched;
  }

  for (const specKey of EQUIPMENT_SPEC_KEYS) {
    if (enriched[specKey]) {
      continue;
    }

    for (const configId of donors) {
      const row = rows.find(
        (entry) =>
          entry.vehicle_configuration_id === configId &&
          entry.spec_key === specKey,
      );
      if (!row) {
        continue;
      }

      if (specKey === "trim_package") {
        enriched[specKey] = toCatalogValue(row);
        break;
      }

      if (row.value_boolean === true) {
        enriched[specKey] = toCatalogValue(row);
        break;
      }
    }
  }

  const donorKeys = new Set<string>();
  for (const configId of donors) {
    for (const row of rows) {
      if (row.vehicle_configuration_id === configId) {
        donorKeys.add(row.spec_key);
      }
    }
  }

  for (const specKey of donorKeys) {
    if (enriched[specKey] || EQUIPMENT_SPEC_KEYS.has(specKey)) {
      continue;
    }
    if (ENGINE_BOUND_SPEC_KEYS.has(specKey)) {
      continue;
    }

    const agreed = siblingsAgreeOnSpec(specKey, donors, rows);
    if (agreed) {
      enriched[specKey] = toCatalogValue(agreed);
    }
  }

  return enriched;
}

type CatalogContext = {
  primaryId: string | null;
  modelMatches: ConfigurationRow[];
  rows: SpecValueRow[];
  catalogKeyById: Map<string, string>;
};


function fuelsMatch(rdwFuel: string, catalogFuel: string): boolean {
  const rdw = normalize(rdwFuel);
  const catalog = normalize(catalogFuel);
  if (!rdw || !catalog) return true;
  const catalogToken = catalog.split(" ")[0];
  return rdw === catalog || rdw.includes(catalogToken);
}

function resolveTrimSlug(
  snapshot: VehicleSnapshot,
  trimGroups: Map<string, string[]>,
  modelMatches: ConfigurationRow[],
  specRows: SpecValueRow[],
  fuelById: Map<string, string>,
  catalogKeyById: Map<string, string>,
): { trimSlug: string | null; confidence: number } {
  if (trimGroups.size === 0) {
    return { trimSlug: null, confidence: 0 };
  }

  if (trimGroups.size === 1) {
    return { trimSlug: [...trimGroups.keys()][0], confidence: 1 };
  }

  const modelTrim = trimSlugFromModelName(snapshot.modelName);
  if (modelTrim && trimGroups.has(modelTrim)) {
    return { trimSlug: modelTrim, confidence: 1 };
  }

  let bestSlug: string | null = null;
  let bestScore = -1;

  for (const [trimSlug, configIds] of trimGroups.entries()) {
    const score = scoreTrimForSnapshot(
      snapshot,
      configIds,
      modelMatches,
      specRows,
      fuelById,
      catalogKeyById,
    );
    if (score > bestScore) {
      bestScore = score;
      bestSlug = trimSlug;
    }
  }

  return { trimSlug: bestSlug, confidence: bestScore };
}

async function resolveCatalogContext(
  snapshot: VehicleSnapshot,
): Promise<CatalogContext> {
  const supabase = createSupabaseServerClient();

  const { data: configs, error: configError } = await supabase
    .from("vehicle_configurations")
    .select("id, brand, model_name, trim_name, catalog_key")
    .ilike("brand", snapshot.brand)
    .not("catalog_key", "like", "rdw:%");

  if (configError) {
    throw new Error(`Failed to load catalog configurations: ${configError.message}`);
  }

  const modelMatches = (configs ?? []).filter(
    (row: ConfigurationRow) =>
      modelsMatch(snapshot.modelName, row.model_name) &&
      withinGeneration(
        snapshot.firstRegistrationYear,
        generationFromCatalogKey(row.catalog_key),
      ),
  );

  if (modelMatches.length === 0) {
    return {
      primaryId: null,
      modelMatches: [],
      rows: [],
      catalogKeyById: new Map(),
    };
  }

  const candidateIds = modelMatches.map((row) => row.id);
  const { data: specRows, error: valueError } = await supabase
    .from("vehicle_configuration_specification_values")
    .select(
      "vehicle_configuration_id, spec_key, value_text, value_numeric, value_boolean",
    )
    .in("vehicle_configuration_id", candidateIds);

  if (valueError) {
    throw new Error(`Failed to load catalog spec values: ${valueError.message}`);
  }

  const rows = (specRows ?? []) as SpecValueRow[];
  const displacementById = new Map<string, number>();
  const fuelById = new Map<string, string>();
  const catalogKeyById = catalogKeyByIdFromMatches(modelMatches);

  for (const row of rows) {
    if (row.spec_key === "engine_displacement_cc" && row.value_numeric !== null) {
      displacementById.set(row.vehicle_configuration_id, Number(row.value_numeric));
    }
    if (row.spec_key === "fuel_type" && row.value_text) {
      fuelById.set(row.vehicle_configuration_id, row.value_text);
    }
  }

  let matchedIds = candidateIds;

  if (snapshot.engineDisplacementCc !== null) {
    const next = matchedIds.filter((id) => {
      const candidate = displacementById.get(id);
      return (
        candidate !== undefined &&
        Math.abs(candidate - snapshot.engineDisplacementCc!) <=
          DISPLACEMENT_TOLERANCE_CC
      );
    });
    if (next.length > 0) matchedIds = next;
  }

  if (snapshot.fuelType) {
    const next = filterByExactFuel(
      matchedIds,
      snapshot.fuelType,
      fuelById,
      catalogKeyById,
    );
    if (next.length > 0) matchedIds = next;
  }

  const trimGroups = groupIdsByTrim(matchedIds, modelMatches);
  const { trimSlug, confidence } = resolveTrimSlug(
    snapshot,
    trimGroups,
    modelMatches,
    rows,
    fuelById,
    catalogKeyById,
  );

  const primaryId = pickExactConfigurationId(
    snapshot,
    matchedIds,
    modelMatches,
    rows,
    fuelById,
    catalogKeyById,
    trimSlug && confidence >= MIN_TRIM_CONFIDENCE_SCORE ? trimSlug : null,
  );

  return { primaryId, modelMatches, rows, catalogKeyById };
}

async function resolveConfigurationId(
  snapshot: VehicleSnapshot,
): Promise<string | null> {
  const context = await resolveCatalogContext(snapshot);
  return context.primaryId;
}

/**
 * Resolve the best-matching catalog configuration for a plate, then return as
 * many accurate specs as possible. Engine-bound values stay on the primary row;
 * trim equipment and agreed trim-level specs may gap-fill from same-trim siblings.
 */
async function fetchCatalogForSnapshot(
  snapshot: VehicleSnapshot,
): Promise<Record<string, CatalogSpecValue>> {
  const { primaryId, modelMatches, rows, catalogKeyById } =
    await resolveCatalogContext(snapshot);

  if (!primaryId) {
    return {};
  }

  const trimSlug = trimSlugFromCatalogKey(catalogKeyById.get(primaryId) ?? "");
  const trimSiblingIds = trimSlug
    ? modelMatches
        .filter((row) => trimSlugFromCatalogKey(row.catalog_key) === trimSlug)
        .map((row) => row.id)
    : [primaryId];

  const primarySpecs = specsFromSingleConfiguration(primaryId, rows);
  return fillGapsFromTrimSiblings(
    primaryId,
    primarySpecs,
    rows,
    trimSiblingIds,
  );
}

export async function loadCatalogForSnapshot(
  snapshot: VehicleSnapshot,
): Promise<CatalogSpecMap> {
  const loader = () => fetchCatalogForSnapshot(snapshot);

  if (process.env.NODE_ENV === "development") {
    return new Map(Object.entries(await loader()));
  }

  const signature = [
    normalize(snapshot.brand),
    normalize(snapshot.modelName),
    snapshot.engineDisplacementCc ?? "",
    normalize(snapshot.fuelType),
    snapshot.firstRegistrationYear ?? "",
    snapshot.configurationKey,
    snapshot.catalogPrice ?? "",
  ].join("|");

  const record = await unstable_cache(loader, ["catalog-for-plate", signature], {
    revalidate: CACHE_TTL_SECONDS,
  })();

  return new Map(Object.entries(record));
}

/**
 * Load catalog spec maps aligned with the given plate results. Plates that were
 * not found, errored, or have no catalog match resolve to null.
 */
export async function loadCatalogForPlates(
  plates: PlateFetchResult[],
): Promise<(CatalogSpecMap | null)[]> {
  return Promise.all(
    plates.map(async (plate) => {
      if (plate.status !== "ok") {
        return null;
      }
      return loadCatalogForSnapshot(plate.snapshot);
    }),
  );
}
