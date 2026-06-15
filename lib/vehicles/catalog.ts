import { unstable_cache } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PlateFetchResult, VehicleSnapshot } from "@/lib/rdw/types";

const CACHE_TTL_SECONDS = 3600;
const DISPLACEMENT_TOLERANCE_CC = 80;

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

/**
 * Reduce several matched catalog trims to a single spec map.
 *
 * - Equipment specs (trim-level) require the value to be present and identical
 *   on every matched trim. A feature only some trims have is omitted, so a plate
 *   never inherits another trim's equipment (shows "-").
 * - Other specs (vehicle/engine-level, e.g. body type, drive wheels, brochure
 *   figures) are shown when the trims that report them agree, even if an
 *   incomplete row is missing it.
 *
 * When trims disagree the key is omitted so the UI shows "-" rather than
 * guessing the wrong trim.
 */
function combineAgreeingSpecs(
  rows: SpecValueRow[],
  matchedCount: number,
  equipmentKeys: Set<string>,
): Record<string, CatalogSpecValue> {
  const bySpecKey = new Map<string, SpecValueRow[]>();
  for (const row of rows) {
    const list = bySpecKey.get(row.spec_key) ?? [];
    list.push(row);
    bySpecKey.set(row.spec_key, list);
  }

  const resolved: Record<string, CatalogSpecValue> = {};
  for (const [specKey, specRows] of bySpecKey.entries()) {
    const distinct = new Set(specRows.map(serializeValue));
    if (distinct.size !== 1) {
      continue;
    }

    const isEquipment = equipmentKeys.has(specKey);
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

    // Mild hybrids share the same combustion engine brochure figures as the
    // petrol catalog row (e.g. 1.0 T-GDI). Include those rows so engine-level
    // manufacturer specs are available without guessing the consumer trim.
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

/**
 * Match a plate's live RDW attributes (brand + model + generation + engine
 * displacement) to scraped catalog trims and return the spec values they share.
 * Works for any brand/model present in the catalog, without needing manual
 * homologation links.
 */
async function fetchCatalogForAttributes(
  brand: string,
  modelName: string,
  displacementCc: number | null,
  fuelType: string | null,
  firstRegistrationYear: number | null,
): Promise<Record<string, CatalogSpecValue>> {
  const supabase = createSupabaseServerClient();

  const { data: configs, error: configError } = await supabase
    .from("vehicle_configurations")
    .select("id, brand, model_name, catalog_key")
    .ilike("brand", brand)
    .not("catalog_key", "like", "rdw:%");

  if (configError) {
    throw new Error(`Failed to load catalog configurations: ${configError.message}`);
  }

  const modelMatches = (configs ?? []).filter(
    (row: ConfigurationRow) =>
      modelsMatch(modelName, row.model_name) &&
      withinGeneration(
        firstRegistrationYear,
        generationFromCatalogKey(row.catalog_key),
      ),
  );

  if (modelMatches.length === 0) {
    return {};
  }

  const candidateIds = modelMatches.map((row) => row.id);
  const [{ data: specRows, error: valueError }, equipmentKeys] = await Promise.all([
    supabase
      .from("vehicle_configuration_specification_values")
      .select(
        "vehicle_configuration_id, spec_key, value_text, value_numeric, value_boolean",
      )
      .in("vehicle_configuration_id", candidateIds),
    loadEquipmentSpecKeys(supabase),
  ]);

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

  // Narrow to the matching engine by displacement + fuel when known. Each filter
  // is only applied if it leaves at least one trim, so a sparsely scraped model
  // still surfaces its shared specs.
  let matchedIds = candidateIds;

  if (displacementCc !== null) {
    const next = matchedIds.filter((id) => {
      const candidate = displacementById.get(id);
      return (
        candidate !== undefined &&
        Math.abs(candidate - displacementCc) <= DISPLACEMENT_TOLERANCE_CC
      );
    });
    if (next.length > 0) matchedIds = next;
  }

  if (fuelType) {
    const next = filterByFuel(
      matchedIds,
      fuelType,
      fuelById,
      displacementCc,
      displacementById,
    );
    if (next.length > 0) matchedIds = next;
  }

  const matchedIdSet = new Set(matchedIds);
  const matchedRows = rows.filter((row) =>
    matchedIdSet.has(row.vehicle_configuration_id),
  );

  return combineAgreeingSpecs(matchedRows, matchedIds.length, equipmentKeys);
}

async function loadCatalogForSnapshot(
  snapshot: VehicleSnapshot,
): Promise<CatalogSpecMap> {
  const loader = () =>
    fetchCatalogForAttributes(
      snapshot.brand,
      snapshot.modelName,
      snapshot.engineDisplacementCc,
      snapshot.fuelType,
      snapshot.firstRegistrationYear,
    );

  // In development, always read fresh catalog data so a scrape is visible
  // immediately without waiting for the cache TTL.
  if (process.env.NODE_ENV === "development") {
    return new Map(Object.entries(await loader()));
  }

  const signature = [
    normalize(snapshot.brand),
    normalize(snapshot.modelName),
    snapshot.engineDisplacementCc ?? "",
    normalize(snapshot.fuelType),
    snapshot.firstRegistrationYear ?? "",
  ].join("|");

  const record = await unstable_cache(loader, ["catalog-for-attributes", signature], {
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
