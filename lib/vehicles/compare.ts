import type { ComparisonGroup } from "@/components/comparison-table";
import { RdwApiError, RdwNotFoundError } from "@/lib/rdw/client";
import { getCachedRdwFuel, getCachedRdwVehicle } from "@/lib/rdw/cache";
import { mapRdwToSnapshot } from "@/lib/rdw/map";
import type { PlateFetchResult } from "@/lib/rdw/types";
import { normalizeKenteken } from "@/lib/kenteken";
import { loadPlateEnrichment, loadPlateListingSnapshot } from "@/lib/enrichment/store";
import type { PlateListingSnapshot } from "@/lib/enrichment/types";
import { loadComparisonSpecifications } from "@/lib/specifications/load";
import { buildComparisonGroups, buildMarketGroup } from "@/lib/specifications/resolve";

export type ComparisonBuildResult = {
  groups: ComparisonGroup[];
  plates: PlateFetchResult[];
  hasNotFound: boolean;
  hasErrors: boolean;
  initiallyEnriched: boolean;
};

export async function fetchPlate(licensePlate: string): Promise<PlateFetchResult> {
  const normalized = normalizeKenteken(licensePlate);

  try {
    const [vehicle, fuel] = await Promise.all([
      getCachedRdwVehicle(normalized),
      getCachedRdwFuel(normalized),
    ]);

    return {
      status: "ok",
      snapshot: mapRdwToSnapshot(normalized, vehicle, fuel),
    };
  } catch (error) {
    if (error instanceof RdwNotFoundError) {
      return { status: "not_found", licensePlate: normalized };
    }

    if (error instanceof RdwApiError) {
      return {
        status: "error",
        licensePlate: normalized,
        message: "Gegevens tijdelijk niet beschikbaar.",
      };
    }

    return {
      status: "error",
      licensePlate: normalized,
      message: "Gegevens tijdelijk niet beschikbaar.",
    };
  }
}

export async function buildComparison(
  formattedKentekens: string[],
): Promise<ComparisonBuildResult> {
  const [specifications, plates] = await Promise.all([
    loadComparisonSpecifications(),
    Promise.all(formattedKentekens.map((kenteken) => fetchPlate(kenteken))),
  ]);

  const okPlates = plates.filter(
    (p): p is PlateFetchResult & { status: "ok" } => p.status === "ok",
  );

  const [cachedEnrichments, listingSnapshots] = await Promise.all([
    Promise.all(okPlates.map((p) => loadPlateEnrichment(p.snapshot.licensePlate))),
    Promise.all(okPlates.map((p) => loadPlateListingSnapshot(p.snapshot.licensePlate))),
  ]);

  const allEnriched =
    okPlates.length > 0 &&
    cachedEnrichments.every((e) => e !== null && e.size > 0);

  // Align listing snapshots with the full plates array (null for non-ok plates)
  let snapshotIndex = 0;
  const alignedSnapshots: (PlateListingSnapshot | null)[] = plates.map((plate) => {
    if (plate.status !== "ok") return null;
    return listingSnapshots[snapshotIndex++] ?? null;
  });

  const marketGroup = buildMarketGroup(plates, alignedSnapshots);
  const prependMarket = (specGroups: ComparisonGroup[]): ComparisonGroup[] =>
    marketGroup ? [marketGroup, ...specGroups] : specGroups;

  if (allEnriched) {
    let enrichedIndex = 0;
    const alignedEnriched = plates.map((plate) => {
      if (plate.status !== "ok") return null;
      return cachedEnrichments[enrichedIndex++] ?? null;
    });

    return {
      groups: prependMarket(buildComparisonGroups(specifications, plates, alignedEnriched)),
      plates,
      hasNotFound: plates.some((p) => p.status === "not_found"),
      hasErrors: plates.some((p) => p.status === "error"),
      initiallyEnriched: true,
    };
  }

  return {
    groups: prependMarket(buildComparisonGroups(specifications, plates, [])),
    plates,
    hasNotFound: plates.some((p) => p.status === "not_found"),
    hasErrors: plates.some((p) => p.status === "error"),
    initiallyEnriched: false,
  };
}
