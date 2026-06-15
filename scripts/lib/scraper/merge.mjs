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
