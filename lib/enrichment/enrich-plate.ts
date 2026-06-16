import { mergeEnrichedSpecs } from "@/lib/enrichment/keywords";
import { searchAutoScout24 } from "@/lib/enrichment/autoscout24";
import { searchCarbase } from "@/lib/enrichment/carbase";
import { searchTextListings } from "@/lib/enrichment/listings";
import {
  loadPlateEnrichment,
  savePlateEnrichment,
} from "@/lib/enrichment/store";
import type { EnrichedSpecMap, PlateEnrichmentResult } from "@/lib/enrichment/types";
import { normalizeKenteken } from "@/lib/kenteken";
import type { VehicleSnapshot } from "@/lib/rdw/types";

export async function enrichPlate(
  snapshot: VehicleSnapshot,
  options: { skipCache?: boolean } = {},
): Promise<PlateEnrichmentResult> {
  const licensePlate = normalizeKenteken(snapshot.licensePlate);

  if (!options.skipCache) {
    const cached = await loadPlateEnrichment(licensePlate);
    if (cached && cached.size > 0) {
      return {
        licensePlate,
        specs: cached,
        fetchedAt: new Date().toISOString(),
      };
    }
  }

  // Priority: listing_claim_structured(3) > listing_claim(2) > trim_inferred(1)
  // Structured (autoscout24) is passed first so it wins tie-breaks at equal priority.
  const [structuredSpecs, textSpecs, carbaseSpecs] = await Promise.all([
    searchAutoScout24(licensePlate),
    searchTextListings(licensePlate),
    searchCarbase(snapshot),
  ]);

  const merged = mergeEnrichedSpecs(structuredSpecs, textSpecs, carbaseSpecs);

  if (merged.size > 0) {
    await savePlateEnrichment(licensePlate, merged);
  }

  return {
    licensePlate,
    specs: merged,
    fetchedAt: new Date().toISOString(),
  };
}

export async function enrichPlates(
  snapshots: VehicleSnapshot[],
  options: { skipCache?: boolean } = {},
): Promise<EnrichedSpecMap[]> {
  const results = await Promise.all(
    snapshots.map((snapshot) => enrichPlate(snapshot, options)),
  );
  return results.map((result) => result.specs);
}
