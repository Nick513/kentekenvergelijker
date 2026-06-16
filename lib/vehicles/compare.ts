import type { ComparisonGroup } from "@/components/comparison-table";
import { RdwApiError, RdwNotFoundError } from "@/lib/rdw/client";
import { getCachedRdwFuel, getCachedRdwVehicle } from "@/lib/rdw/cache";
import { mapRdwToSnapshot } from "@/lib/rdw/map";
import type { PlateFetchResult } from "@/lib/rdw/types";
import { normalizeKenteken } from "@/lib/kenteken";
import { loadComparisonSpecifications } from "@/lib/specifications/load";
import {
  buildComparisonGroups,
  filterEmptyComparisonGroups,
} from "@/lib/specifications/resolve";
import { loadCatalogForPlates } from "@/lib/vehicles/catalog";

export type ComparisonBuildResult = {
  groups: ComparisonGroup[];
  plates: PlateFetchResult[];
  hasNotFound: boolean;
  hasErrors: boolean;
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

  const catalogs = await loadCatalogForPlates(plates);

  return {
    groups: filterEmptyComparisonGroups(
      buildComparisonGroups(specifications, plates, [], catalogs),
    ),
    plates,
    hasNotFound: plates.some((plate) => plate.status === "not_found"),
    hasErrors: plates.some((plate) => plate.status === "error"),
  };
}
