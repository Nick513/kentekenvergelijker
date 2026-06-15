// Merge primary (brochure) configurations with Plan B configurations.
// Rules: brochure wins; Plan B only fills spec_keys that are still empty for a
// matching catalog_key. Plan B configurations with no primary match become their
// own rows (Plan B also serves trim discovery).

import { buildCatalogKey } from "./catalog-key.mjs";

function safeCatalogKey(config) {
  try {
    return buildCatalogKey({
      brand: config.brand,
      model: config.modelName,
      generation: config.generation,
      trim: config.trimName,
      engine: config.engineName,
    });
  } catch {
    return null;
  }
}

function indexConfig(byKey, config, skipped) {
  const key = safeCatalogKey(config);
  if (!key) {
    skipped.push(config);
    return null;
  }

  if (!byKey.has(key)) {
    const specMap = new Map();
    for (const spec of config.specs) {
      specMap.set(spec.spec_key, { ...spec, source: spec.source ?? config.sourceTag });
    }
    byKey.set(key, { catalogKey: key, config, specMap });
  }

  return byKey.get(key);
}

/**
 * @param {Array<object>} primaryConfigs configurations from manufacturer source
 * @param {Array<object>} planBConfigs configurations from Plan B sources
 * @returns {{ configurations: Array<object>, skipped: Array<object> }}
 */
export function mergeConfigurations(primaryConfigs, planBConfigs) {
  const byKey = new Map();
  const skipped = [];

  for (const config of primaryConfigs) {
    indexConfig(byKey, config, skipped);
  }

  for (const config of planBConfigs) {
    const entry = indexConfig(byKey, config, skipped);
    if (!entry) continue;

    for (const spec of config.specs) {
      if (!entry.specMap.has(spec.spec_key)) {
        entry.specMap.set(spec.spec_key, {
          ...spec,
          source: spec.source ?? config.sourceTag,
        });
      }
    }
  }

  const configurations = [...byKey.values()].map((entry) => ({
    brand: entry.config.brand,
    modelName: entry.config.modelName,
    generation: entry.config.generation,
    trimName: entry.config.trimName,
    engineName: entry.config.engineName,
    catalogKey: entry.catalogKey,
    specs: [...entry.specMap.values()],
  }));

  return { configurations, skipped };
}

function isHybridEngine(engineName) {
  return String(engineName).toLowerCase().includes("hybride");
}

function isPetrolEngine(engineName) {
  const engine = String(engineName).toLowerCase();
  return engine.includes("benzine") && !engine.includes("hybride");
}

function trimIdentity(config) {
  return [
    config.brand,
    config.modelName,
    config.generation,
    config.trimName,
  ].join("|");
}

function engineFamily(engineName) {
  const normalized = String(engineName).toLowerCase();
  const match = normalized.match(/(\d)[.-](\d)/);
  if (match) {
    return `${match[1]}-${match[2]}`;
  }
  return normalized;
}

/**
 * Copy brochure trim equipment from petrol catalog rows onto mild-hybrid rows
 * with the same uitvoering. Plan B only discovers hybrid listings; equipment
 * tiers in the Hyundai price list are fuel-agnostic.
 */
export function propagatePetrolEquipmentToHybridVariants(
  configurations,
  equipmentSpecKeys,
) {
  const equipmentKeys =
    equipmentSpecKeys instanceof Set
      ? equipmentSpecKeys
      : new Set(equipmentSpecKeys ?? []);

  const byTrim = new Map();
  for (const config of configurations) {
    const key = trimIdentity(config);
    if (!byTrim.has(key)) byTrim.set(key, []);
    byTrim.get(key).push(config);
  }

  for (const configs of byTrim.values()) {
    const petrol = configs.filter((config) => isPetrolEngine(config.engineName));
    const hybrid = configs.filter((config) => isHybridEngine(config.engineName));
    if (petrol.length === 0 || hybrid.length === 0) continue;

    for (const hybridConfig of hybrid) {
      const petrolSibling = petrol.find(
        (config) =>
          engineFamily(config.engineName) === engineFamily(hybridConfig.engineName),
      );
      if (!petrolSibling) continue;

      const existing = new Set(hybridConfig.specs.map((spec) => spec.spec_key));
      for (const spec of petrolSibling.specs) {
        const isEquipment =
          equipmentKeys.has(spec.spec_key) || spec.spec_key === "trim_package";
        if (!isEquipment || existing.has(spec.spec_key)) continue;
        hybridConfig.specs.push({ ...spec });
        existing.add(spec.spec_key);
      }
    }
  }

  return configurations;
}
