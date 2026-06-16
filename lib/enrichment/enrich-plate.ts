import { mergeEnrichedSpecs } from "@/lib/enrichment/keywords";
import { listingToSpecs, searchListingByPlate } from "@/lib/enrichment/listings";
import {
  catalogToEnriched,
  loadPlateEnrichment,
  savePlateEnrichment,
} from "@/lib/enrichment/store";
import type { EnrichedSpecMap, PlateEnrichmentResult } from "@/lib/enrichment/types";
import { verificationForCatalogSpec } from "@/lib/enrichment/verification";
import { normalizeKenteken } from "@/lib/kenteken";
import type { VehicleSnapshot } from "@/lib/rdw/types";
import { loadCatalogForSnapshot } from "@/lib/vehicles/catalog";
import type { ComparisonSpecification } from "@/lib/specifications/types";

function applyCatalogVerification(
  specs: EnrichedSpecMap,
  specifications: ComparisonSpecification[],
): EnrichedSpecMap {
  const specByKey = new Map(specifications.map((spec) => [spec.specKey, spec]));
  const adjusted: EnrichedSpecMap = new Map();

  for (const [key, value] of specs.entries()) {
    if (value.verification !== "trim_inferred") {
      adjusted.set(key, value);
      continue;
    }

    const spec = specByKey.get(key);
    adjusted.set(key, {
      ...value,
      verification: spec
        ? verificationForCatalogSpec(key, spec.valueSource)
        : "trim_inferred",
    });
  }

  return adjusted;
}

export async function enrichPlate(
  snapshot: VehicleSnapshot,
  specifications: ComparisonSpecification[],
  options: { skipCache?: boolean } = {},
): Promise<PlateEnrichmentResult> {
  const licensePlate = normalizeKenteken(snapshot.licensePlate);

  if (!options.skipCache) {
    const cached = await loadPlateEnrichment(licensePlate);
    if (cached && cached.size > 0) {
      return {
        licensePlate,
        listing: null,
        specs: cached,
        fetchedAt: new Date().toISOString(),
      };
    }
  }

  const listing = await searchListingByPlate(licensePlate);
  const listingSpecs = listing ? listingToSpecs(listing) : new Map();

  const catalog = await loadCatalogForSnapshot(snapshot);
  const catalogSpecs = applyCatalogVerification(
    catalogToEnriched(catalog),
    specifications,
  );

  const merged = mergeEnrichedSpecs(listingSpecs, catalogSpecs);

  if (merged.size > 0) {
    await savePlateEnrichment(licensePlate, merged);
  }

  return {
    licensePlate,
    listing,
    specs: merged,
    fetchedAt: new Date().toISOString(),
  };
}

export async function enrichPlates(
  snapshots: VehicleSnapshot[],
  specifications: ComparisonSpecification[],
  options: { skipCache?: boolean } = {},
): Promise<EnrichedSpecMap[]> {
  const results = await Promise.all(
    snapshots.map((snapshot) =>
      enrichPlate(snapshot, specifications, options),
    ),
  );
  return results.map((result) => result.specs);
}
