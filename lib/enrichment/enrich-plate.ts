import { mergeEnrichedSpecs } from "@/lib/enrichment/keywords";
import { searchAutoScout24 } from "@/lib/enrichment/autoscout24";
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

  const [textSpecs, structuredSpecs] = await Promise.all([
    searchTextListings(licensePlate),
    searchAutoScout24(licensePlate),
  ]);

  // Priority: listing_claim_structured(3) > listing_claim(2)
  // structuredSpecs is passed first so it wins tie-breaks over text at equal priority.
  const merged = mergeEnrichedSpecs(structuredSpecs, textSpecs);

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
