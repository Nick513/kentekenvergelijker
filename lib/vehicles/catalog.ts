import { unstable_cache } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PlateFetchResult, VehicleSnapshot } from "@/lib/rdw/types";

const CACHE_TTL_SECONDS = 3600;
const DISPLACEMENT_TOLERANCE_CC = 80;
const CATALOG_PRICE_TOLERANCE = 2500;
const LIST_PRICE_TOLERANCE = 4000;
/** Fallback when fiscal_list_price is missing; catalogusprijs ≈ rijklaarprijs minus BPM. */
const FISCAL_TO_LIST_RATIO = 0.8203;

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

function serializeValue(row: SpecValueRow): string {
  return JSON.stringify([row.value_text, row.value_numeric, row.value_boolean]);
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

function pickPrimaryConfigId(
  configIds: string[],
  fuelType: string | null,
  fuelById: Map<string, string>,
): string | null {
  if (isHybridFuel(fuelType)) {
    const hybrid = configIds.find((id) => isHybridFuel(fuelById.get(id)));
    if (hybrid) {
      return hybrid;
    }
  }

  const petrol = configIds.find((id) => isPetrolFuel(fuelById.get(id)));
  return petrol ?? configIds[0] ?? null;
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
  specRows: SpecValueRow[],
  fuelById: Map<string, string>,
): number {
  const primaryId = pickPrimaryConfigId(configIds, snapshot.fuelType, fuelById);
  if (!primaryId) {
    return 0;
  }

  let score = 0;

  if (snapshot.catalogPrice !== null) {
    const fiscal = getNumericSpec(primaryId, "fiscal_list_price", specRows);
    const listPrice = getNumericSpec(
      primaryId,
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
    const power = getNumericSpec(primaryId, "power_kw", specRows);
    if (power !== null && Math.abs(power - snapshot.powerKw) <= 4) {
      score += 0.5;
    }
  }

  if (snapshot.co2EmissionGKm !== null) {
    const co2 = getNumericSpec(primaryId, "co2_emission_g_km", specRows);
    if (co2 !== null && Math.abs(co2 - snapshot.co2EmissionGKm) <= 15) {
      score += 0.4;
    }
  }

  if (snapshot.curbWeightKg !== null) {
    const weight = getNumericSpec(primaryId, "curb_weight_kg", specRows);
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

function applyTrimFilter(
  matchedIds: string[],
  candidateIds: string[],
  modelMatches: ConfigurationRow[],
  trimSlug: string,
  fuelType: string | null,
  displacementCc: number | null,
  fuelById: Map<string, string>,
  displacementById: Map<string, number>,
): string[] {
  const trimmed = matchedIds.filter((id) => {
    const row = modelMatches.find((entry) => entry.id === id);
    return row && trimSlugFromCatalogKey(row.catalog_key) === trimSlug;
  });

  if (trimmed.length === 0) {
    return matchedIds;
  }

  let resolved = trimmed;

  if (fuelType && isHybridFuel(fuelType) && displacementCc !== null) {
    const petrolTrimSiblings = candidateIds.filter((id) => {
      if (trimmed.includes(id)) {
        return false;
      }
      const row = modelMatches.find((entry) => entry.id === id);
      if (!row || trimSlugFromCatalogKey(row.catalog_key) !== trimSlug) {
        return false;
      }
      const fuel = fuelById.get(id);
      const displacement = displacementById.get(id);
      if (fuel === undefined || displacement === undefined) {
        return false;
      }
      return (
        isPetrolFuel(fuel) &&
        Math.abs(displacement - displacementCc) <= DISPLACEMENT_TOLERANCE_CC
      );
    });
    resolved = [...new Set([...trimmed, ...petrolTrimSiblings])];
  }

  return resolved;
}

/**
 * Reduce matched catalog rows to a single spec map.
 *
 * When a trim is resolved, equipment comes from that uitvoering (brochure rows
 * on the petrol sibling fill mild-hybrid gaps). Without a resolved trim,
 * equipment only shows when every still-matched trim agrees.
 */
function combineAgreeingSpecs(
  rows: SpecValueRow[],
  matchedCount: number,
  equipmentKeys: Set<string>,
  options: {
    resolvedTrim?: boolean;
    fuelById?: Map<string, string>;
  } = {},
): Record<string, CatalogSpecValue> {
  const { resolvedTrim = false, fuelById = new Map() } = options;
  const bySpecKey = new Map<string, SpecValueRow[]>();
  for (const row of rows) {
    const list = bySpecKey.get(row.spec_key) ?? [];
    list.push(row);
    bySpecKey.set(row.spec_key, list);
  }

  const resolved: Record<string, CatalogSpecValue> = {};
  for (const [specKey, specRows] of bySpecKey.entries()) {
    const isEquipment = equipmentKeys.has(specKey);

    if (resolvedTrim && isEquipment) {
      const trueRow = specRows.find((row) => row.value_boolean === true);
      if (trueRow) {
        resolved[specKey] = toCatalogValue(trueRow);
        continue;
      }

      const withData = specRows.filter(
        (row) =>
          row.value_boolean === true ||
          row.value_text !== null ||
          row.value_numeric !== null,
      );
      if (withData.length > 0) {
        const distinct = new Set(withData.map(serializeValue));
        if (distinct.size === 1) {
          resolved[specKey] = toCatalogValue(withData[0]);
        }
      }
      continue;
    }

    if (resolvedTrim && !isEquipment && fuelById.size > 0) {
      const hybridRows = specRows.filter((row) =>
        isHybridFuel(fuelById.get(row.vehicle_configuration_id)),
      );
      const petrolRows = specRows.filter((row) =>
        isPetrolFuel(fuelById.get(row.vehicle_configuration_id)),
      );

      for (const pool of [hybridRows, petrolRows, specRows]) {
        if (pool.length === 0) {
          continue;
        }
        const distinct = new Set(pool.map(serializeValue));
        if (distinct.size === 1) {
          resolved[specKey] = toCatalogValue(pool[0]);
          break;
        }
      }
      continue;
    }

    const distinct = new Set(specRows.map(serializeValue));
    if (distinct.size !== 1) {
      continue;
    }

    const presentInAll = specRows.length === matchedCount;
    if (isEquipment && !presentInAll) {
      continue;
    }

    resolved[specKey] = toCatalogValue(specRows[0]);
  }

  return resolved;
}

async function loadEquipmentSpecKeys(
  supabase: ReturnType<typeof createSupabaseServerClient>,
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("specifications")
    .select("spec_key, value_source")
    .eq("value_source", "equipment");

  if (error) {
    throw new Error(`Failed to load equipment spec keys: ${error.message}`);
  }

  return new Set((data ?? []).map((row) => row.spec_key));
}

async function loadLinkedConfigurationIds(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  configurationKey: string,
): Promise<string[]> {
  if (!configurationKey) {
    return [];
  }

  const { data, error } = await supabase
    .from("configuration_links")
    .select("vehicle_configuration_id")
    .eq("configuration_key", configurationKey);

  if (error) {
    throw new Error(`Failed to load configuration links: ${error.message}`);
  }

  return (data ?? []).map((row) => row.vehicle_configuration_id);
}

function fuelsMatch(rdwFuel: string, catalogFuel: string): boolean {
  const rdw = normalize(rdwFuel);
  const catalog = normalize(catalogFuel);
  if (!rdw || !catalog) return true;
  const catalogToken = catalog.split(" ")[0];
  return rdw === catalog || rdw.includes(catalogToken);
}

/** Prefer the most specific fuel family when RDW reports a hybrid drivetrain. */
function filterByFuel(
  candidateIds: string[],
  rdwFuel: string | null,
  fuelById: Map<string, string>,
  displacementCc: number | null,
  displacementById: Map<string, number>,
): string[] {
  if (!rdwFuel) return candidateIds;

  const rdw = normalize(rdwFuel);
  const isHybrid = rdw.includes("hybride") || rdw.includes("hybrid");

  if (isHybrid) {
    const hybridMatches = candidateIds.filter((id) => {
      const fuel = fuelById.get(id);
      return fuel !== undefined && normalize(fuel).includes("hybride");
    });

    const petrolSiblings =
      displacementCc === null
        ? []
        : candidateIds.filter((id) => {
            const fuel = fuelById.get(id);
            const displacement = displacementById.get(id);
            if (fuel === undefined || displacement === undefined) return false;
            const normalized = normalize(fuel);
            return (
              normalized.includes("benzine") &&
              !normalized.includes("hybride") &&
              Math.abs(displacement - displacementCc) <= DISPLACEMENT_TOLERANCE_CC
            );
          });

    const merged = [...new Set([...hybridMatches, ...petrolSiblings])];
    if (merged.length > 0) return merged;
  }

  for (const token of ["benzine", "diesel", "elektrisch", "lpg"]) {
    if (!rdw.includes(token)) continue;
    const matches = candidateIds.filter((id) => {
      const fuel = fuelById.get(id);
      if (fuel === undefined) return false;
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

function resolveTrimSlug(
  snapshot: VehicleSnapshot,
  trimGroups: Map<string, string[]>,
  specRows: SpecValueRow[],
  fuelById: Map<string, string>,
): string | null {
  if (trimGroups.size === 0) {
    return null;
  }

  if (trimGroups.size === 1) {
    return [...trimGroups.keys()][0];
  }

  const modelTrim = trimSlugFromModelName(snapshot.modelName);
  if (modelTrim && trimGroups.has(modelTrim)) {
    return modelTrim;
  }

  let bestSlug: string | null = null;
  let bestScore = -1;

  for (const [trimSlug, configIds] of trimGroups.entries()) {
    const score = scoreTrimForSnapshot(snapshot, configIds, specRows, fuelById);
    if (score > bestScore) {
      bestScore = score;
      bestSlug = trimSlug;
    }
  }

  return bestSlug;
}

async function resolveConfigurationIds(
  snapshot: VehicleSnapshot,
): Promise<{ matchedIds: string[]; trimResolved: boolean }> {
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
    return { matchedIds: [], trimResolved: false };
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
    const next = filterByFuel(
      matchedIds,
      snapshot.fuelType,
      fuelById,
      snapshot.engineDisplacementCc,
      displacementById,
    );
    if (next.length > 0) matchedIds = next;
  }

  const linkedIds = await loadLinkedConfigurationIds(
    supabase,
    snapshot.configurationKey,
  );
  const linkedMatches = matchedIds.filter((id) => linkedIds.includes(id));
  if (linkedMatches.length > 0) {
    const linkedRow = modelMatches.find((row) => row.id === linkedMatches[0]);
    const trimSlug = linkedRow
      ? trimSlugFromCatalogKey(linkedRow.catalog_key)
      : null;
    if (trimSlug) {
      return {
        matchedIds: applyTrimFilter(
          matchedIds,
          candidateIds,
          modelMatches,
          trimSlug,
          snapshot.fuelType,
          snapshot.engineDisplacementCc,
          fuelById,
          displacementById,
        ),
        trimResolved: true,
      };
    }
  }

  const trimGroups = groupIdsByTrim(matchedIds, modelMatches);
  const trimSlug = resolveTrimSlug(snapshot, trimGroups, rows, fuelById);

  if (!trimSlug) {
    return { matchedIds, trimResolved: false };
  }

  return {
    matchedIds: applyTrimFilter(
      matchedIds,
      candidateIds,
      modelMatches,
      trimSlug,
      snapshot.fuelType,
      snapshot.engineDisplacementCc,
      fuelById,
      displacementById,
    ),
    trimResolved: true,
  };
}

/**
 * Match a plate's live RDW attributes to the best catalog configuration and
 * return its spec values.
 */
async function fetchCatalogForSnapshot(
  snapshot: VehicleSnapshot,
): Promise<Record<string, CatalogSpecValue>> {
  const supabase = createSupabaseServerClient();
  const { matchedIds, trimResolved } = await resolveConfigurationIds(snapshot);

  if (matchedIds.length === 0) {
    return {};
  }

  const [{ data: specRows, error: valueError }, equipmentKeys] = await Promise.all([
    supabase
      .from("vehicle_configuration_specification_values")
      .select(
        "vehicle_configuration_id, spec_key, value_text, value_numeric, value_boolean",
      )
      .in("vehicle_configuration_id", matchedIds),
    loadEquipmentSpecKeys(supabase),
  ]);

  if (valueError) {
    throw new Error(`Failed to load catalog spec values: ${valueError.message}`);
  }

  const rows = (specRows ?? []) as SpecValueRow[];
  const matchedIdSet = new Set(matchedIds);
  const matchedRows = rows.filter((row) =>
    matchedIdSet.has(row.vehicle_configuration_id),
  );

  const fuelById = new Map<string, string>();
  for (const row of rows) {
    if (row.spec_key === "fuel_type" && row.value_text) {
      fuelById.set(row.vehicle_configuration_id, row.value_text);
    }
  }

  return combineAgreeingSpecs(matchedRows, matchedIds.length, equipmentKeys, {
    resolvedTrim: trimResolved,
    fuelById,
  });
}

async function loadCatalogForSnapshot(
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
