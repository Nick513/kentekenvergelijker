import { mergeEnrichedSpecs } from "@/lib/enrichment/keywords";
import { searchAutoScout24 } from "@/lib/enrichment/autoscout24";
import { searchCarbase } from "@/lib/enrichment/carbase";
import { searchTextListings } from "@/lib/enrichment/listings";
import {
  loadPlateEnrichment,
  savePlateEnrichment,
  savePlateListingSnapshot,
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

  const [autoScoutResult, textResult, carbaseSpecs] = await Promise.all([
    searchAutoScout24(licensePlate),
    searchTextListings(licensePlate),
    searchCarbase(snapshot),
  ]);

  const merged = mergeEnrichedSpecs(autoScoutResult.specs, textResult.specs, carbaseSpecs);

  if (merged.size > 0) {
    await savePlateEnrichment(licensePlate, merged);
  }

  const mileageKm = autoScoutResult.mileageKm ?? textResult.mileageKm;
  const askingPriceEur = autoScoutResult.askingPriceEur ?? textResult.askingPriceEur;

  if (mileageKm !== null || askingPriceEur !== null) {
    await savePlateListingSnapshot({
      licensePlate,
      mileageKm,
      askingPriceEur,
      listingUrl: null,
      lastSeenAt: new Date().toISOString(),
    }).catch(() => {
      // Non-fatal: market data save failure should not break enrichment
    });
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
