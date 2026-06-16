// Mirrors lib/vehicles/catalog.ts resolution for dev scripts (single exact config per plate).

const DISPLACEMENT_TOLERANCE_CC = 80;
const CATALOG_PRICE_TOLERANCE = 2500;
const LIST_PRICE_TOLERANCE = 4000;
const FISCAL_TO_LIST_RATIO = 0.8203;
const MIN_TRIM_CONFIDENCE_SCORE = 0.3;

function normalize(value) {
  return (value ?? "").toLowerCase().trim();
}

export function trimSlugFromCatalogKey(catalogKey) {
  return catalogKey.split("|")[3] ?? null;
}

export function engineSlugFromCatalogKey(catalogKey) {
  return catalogKey.split("|")[4] ?? null;
}

function generationFromCatalogKey(catalogKey) {
  return catalogKey.split("|")[2] ?? null;
}

function withinGeneration(year, generationSlug) {
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

function modelsMatch(rdwModel, catalogModel) {
  const a = normalize(rdwModel);
  const b = normalize(catalogModel);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

function isHybridFuel(fuel) {
  const normalized = normalize(fuel);
  return normalized.includes("hybride") || normalized.includes("hybrid");
}

function isPetrolFuel(fuel) {
  const normalized = normalize(fuel);
  return normalized.includes("benzine") && !normalized.includes("hybride");
}

function isHybridEngineSlug(engineSlug) {
  const normalized = normalize(engineSlug);
  return (
    normalized.includes("hybride") ||
    normalized.includes("hybrid") ||
    normalized.includes("mhev") ||
    normalized.includes("phev")
  );
}

function isHybridCatalogRow(configId, fuelById, catalogKeyById) {
  const fuel = fuelById.get(configId);
  if (fuel && isHybridFuel(fuel)) return true;
  return isHybridEngineSlug(engineSlugFromCatalogKey(catalogKeyById.get(configId) ?? ""));
}

function isPetrolCatalogRow(configId, fuelById, catalogKeyById) {
  if (isHybridCatalogRow(configId, fuelById, catalogKeyById)) return false;
  const fuel = fuelById.get(configId);
  if (fuel && isPetrolFuel(fuel)) return true;
  const engineSlug = normalize(engineSlugFromCatalogKey(catalogKeyById.get(configId) ?? ""));
  return engineSlug.includes("benzine");
}

function catalogKeyByIdFromMatches(modelMatches) {
  return new Map(modelMatches.map((row) => [row.id, row.catalog_key]));
}

function fuelsMatch(rdwFuel, catalogFuel) {
  const rdw = normalize(rdwFuel);
  const catalog = normalize(catalogFuel);
  if (!rdw || !catalog) return true;
  const catalogToken = catalog.split(" ")[0];
  return rdw === catalog || rdw.includes(catalogToken);
}

export function filterByExactFuel(candidateIds, rdwFuel, fuelById, catalogKeyById) {
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
      if (isHybridCatalogRow(id, fuelById, catalogKeyById)) return false;
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

function getNumericSpec(configId, specKey, specRows) {
  const row = specRows.find(
    (entry) => entry.vehicle_configuration_id === configId && entry.spec_key === specKey,
  );
  if (!row || row.value_numeric === null || row.value_numeric === undefined) return null;
  return Number(row.value_numeric);
}

function pickPrimaryConfigId(configIds, fuelType, fuelById, catalogKeyById) {
  if (isHybridFuel(fuelType)) {
    const hybrid = configIds.find((id) =>
      isHybridCatalogRow(id, fuelById, catalogKeyById),
    );
    if (hybrid) return hybrid;
  }
  const petrol = configIds.find((id) => isPetrolCatalogRow(id, fuelById, catalogKeyById));
  return petrol ?? configIds[0] ?? null;
}

function pickPricingConfigId(configIds, fuelType, fuelById, catalogKeyById, specRows, pricingCandidateIds) {
  const pricingPool = pricingCandidateIds ?? configIds;
  const primaryId = pickPrimaryConfigId(configIds, fuelType, fuelById, catalogKeyById);
  if (!primaryId) return null;

  const hasPrice =
    getNumericSpec(primaryId, "fiscal_list_price", specRows) !== null ||
    getNumericSpec(primaryId, "list_price_ready_to_drive", specRows) !== null;

  if (hasPrice) return primaryId;

  const petrolSibling = pricingPool.find((id) =>
    isPetrolCatalogRow(id, fuelById, catalogKeyById),
  );
  return petrolSibling ?? primaryId;
}

function pricingPoolForTrim(trimSlug, modelMatches) {
  if (!trimSlug) return [];
  return modelMatches
    .filter((row) => trimSlugFromCatalogKey(row.catalog_key) === trimSlug)
    .map((row) => row.id);
}

function trimSlugFromModelName(modelName) {
  const normalized = normalize(modelName);
  const tokens = [
    ["premium sky", "premium-sky"],
    ["premium", "premium"],
    ["comfort smart", "comfort-smart"],
    ["comfort", "comfort"],
    ["n line", "n-line"],
    ["i-motion", "i-motion"],
  ];
  for (const [phrase, slug] of tokens) {
    if (normalized.includes(phrase)) return slug;
  }
  return null;
}

function scoreTrimForSnapshot(snapshot, configIds, modelMatches, specRows, fuelById, catalogKeyById) {
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
  if (!pricingId && !primaryId) return 0;

  let score = 0;

  if (snapshot.catalogPrice !== null && pricingId) {
    const fiscal = getNumericSpec(pricingId, "fiscal_list_price", specRows);
    const listPrice = getNumericSpec(pricingId, "list_price_ready_to_drive", specRows);

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
  if (!specSourceId) return score;

  if (snapshot.powerKw !== null) {
    const power = getNumericSpec(specSourceId, "power_kw", specRows);
    if (power !== null && Math.abs(power - snapshot.powerKw) <= 4) score += 0.5;
  }

  if (snapshot.co2EmissionGKm !== null) {
    const co2 = getNumericSpec(specSourceId, "co2_emission_g_km", specRows);
    if (co2 !== null && Math.abs(co2 - snapshot.co2EmissionGKm) <= 15) score += 0.4;
  }

  if (snapshot.curbWeightKg !== null) {
    const weight = getNumericSpec(specSourceId, "curb_weight_kg", specRows);
    if (weight !== null && Math.abs(weight - snapshot.curbWeightKg) <= 50) score += 0.3;
  }

  return score;
}

function scoreConfigurationForSnapshot(
  snapshot,
  configId,
  modelMatches,
  specRows,
  fuelById,
  catalogKeyById,
) {
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
    const listPrice = getNumericSpec(pricingId, "list_price_ready_to_drive", specRows);

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
    if (power !== null && Math.abs(power - snapshot.powerKw) <= 4) score += 0.5;
  }

  if (snapshot.co2EmissionGKm !== null) {
    const co2 = getNumericSpec(configId, "co2_emission_g_km", specRows);
    if (co2 !== null && Math.abs(co2 - snapshot.co2EmissionGKm) <= 15) score += 0.4;
  }

  if (snapshot.curbWeightKg !== null) {
    const weight = getNumericSpec(configId, "curb_weight_kg", specRows);
    if (weight !== null && Math.abs(weight - snapshot.curbWeightKg) <= 50) score += 0.3;
  }

  return score;
}

function groupIdsByTrim(configIds, modelMatches) {
  const groups = new Map();
  for (const id of configIds) {
    const row = modelMatches.find((entry) => entry.id === id);
    const trimSlug = row ? trimSlugFromCatalogKey(row.catalog_key) : null;
    if (!trimSlug) continue;
    const list = groups.get(trimSlug) ?? [];
    list.push(id);
    groups.set(trimSlug, list);
  }
  return groups;
}

function resolveTrimSlug(snapshot, trimGroups, modelMatches, specRows, fuelById, catalogKeyById) {
  if (trimGroups.size === 0) return { trimSlug: null, confidence: 0 };
  if (trimGroups.size === 1) return { trimSlug: [...trimGroups.keys()][0], confidence: 1 };

  const modelTrim = trimSlugFromModelName(snapshot.modelName);
  if (modelTrim && trimGroups.has(modelTrim)) {
    return { trimSlug: modelTrim, confidence: 1 };
  }

  let bestSlug = null;
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

function pickExactConfigurationId(
  snapshot,
  candidateIds,
  modelMatches,
  specRows,
  fuelById,
  catalogKeyById,
  trimSlug,
) {
  let candidates = candidateIds;

  if (trimSlug) {
    const inTrim = candidates.filter((id) => {
      const row = modelMatches.find((entry) => entry.id === id);
      return row && trimSlugFromCatalogKey(row.catalog_key) === trimSlug;
    });
    if (inTrim.length > 0) candidates = inTrim;
  }

  candidates = filterByExactFuel(
    candidates,
    snapshot.fuelType,
    fuelById,
    catalogKeyById,
  );
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  let bestId = null;
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

/**
 * Resolve exactly one vehicle_configuration_id for a plate snapshot.
 */
export function resolveConfigurationId(snapshot, modelMatches, specRows) {
  const displacementById = new Map();
  const fuelById = new Map();
  const catalogKeyById = catalogKeyByIdFromMatches(modelMatches);

  for (const row of specRows ?? []) {
    if (row.spec_key === "engine_displacement_cc" && row.value_numeric !== null) {
      displacementById.set(row.vehicle_configuration_id, Number(row.value_numeric));
    }
    if (row.spec_key === "fuel_type" && row.value_text) {
      fuelById.set(row.vehicle_configuration_id, row.value_text);
    }
  }

  let matchedIds = modelMatches.map((row) => row.id);

  if (snapshot.engineDisplacementCc !== null) {
    const next = matchedIds.filter((id) => {
      const candidate = displacementById.get(id);
      return (
        candidate !== undefined &&
        Math.abs(candidate - snapshot.engineDisplacementCc) <= DISPLACEMENT_TOLERANCE_CC
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
    specRows ?? [],
    fuelById,
    catalogKeyById,
  );

  if (!trimSlug || confidence < MIN_TRIM_CONFIDENCE_SCORE) {
    return pickExactConfigurationId(
      snapshot,
      matchedIds,
      modelMatches,
      specRows ?? [],
      fuelById,
      catalogKeyById,
      null,
    );
  }

  return pickExactConfigurationId(
    snapshot,
    matchedIds,
    modelMatches,
    specRows ?? [],
    fuelById,
    catalogKeyById,
    trimSlug,
  );
}

export function filterModelMatches(snapshot, configs) {
  return (configs ?? []).filter((row) => {
    const modelName = row.model_name ?? row.catalog_key.split("|")[1] ?? "";
    return (
      modelsMatch(snapshot.modelName, modelName) &&
      withinGeneration(
        snapshot.firstRegistrationYear,
        generationFromCatalogKey(row.catalog_key),
      )
    );
  });
}
