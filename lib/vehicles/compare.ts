import type { ComparisonGroup } from "@/components/comparison-table";
import { RdwApiError, RdwNotFoundError } from "@/lib/rdw/client";
import { getCachedRdwFuel, getCachedRdwVehicle } from "@/lib/rdw/cache";
import {
  formatApkDate,
  formatBrandModel,
  formatCatalogPrice,
  formatElectricRange,
  formatPowerKw,
  mapRdwToSnapshot,
} from "@/lib/rdw/map";
import type { PlateFetchResult } from "@/lib/rdw/types";
import { normalizeKenteken } from "@/lib/kenteken";

export type ComparisonBuildResult = {
  groups: ComparisonGroup[];
  plates: PlateFetchResult[];
  hasNotFound: boolean;
  hasErrors: boolean;
};

async function fetchPlate(licensePlate: string): Promise<PlateFetchResult> {
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
        message: error.message,
      };
    }

    return {
      status: "error",
      licensePlate: normalized,
      message: "Kon RDW-gegevens niet ophalen.",
    };
  }
}

function cellForPlate(
  result: PlateFetchResult,
  render: (snapshot: PlateFetchResult & { status: "ok" }) => string,
): string {
  if (result.status === "ok") {
    return render(result);
  }
  if (result.status === "not_found") {
    return "Niet gevonden";
  }
  return "-";
}

function buildGroups(plates: PlateFetchResult[]): ComparisonGroup[] {
  return [
    {
      title: "Algemeen",
      rows: [
        {
          label: "Merk & model",
          values: plates.map((plate) =>
            cellForPlate(plate, (ok) => formatBrandModel(ok.snapshot)),
          ),
        },
        {
          label: "Uitvoering / pakket",
          values: plates.map(() => "-"),
        },
        {
          label: "Kleur",
          values: plates.map((plate) =>
            cellForPlate(plate, (ok) => ok.snapshot.primaryColor ?? "-"),
          ),
        },
        {
          label: "APK vervaldatum",
          values: plates.map((plate) =>
            cellForPlate(plate, (ok) => formatApkDate(ok.snapshot.apkExpiryDate)),
          ),
        },
        {
          label: "Catalogusprijs",
          values: plates.map((plate) =>
            cellForPlate(plate, (ok) =>
              formatCatalogPrice(ok.snapshot.catalogPrice),
            ),
          ),
        },
      ],
    },
    {
      title: "Motor & aandrijving",
      rows: [
        {
          label: "Brandstof",
          values: plates.map((plate) =>
            cellForPlate(plate, (ok) => ok.snapshot.fuelType ?? "-"),
          ),
        },
        {
          label: "Vermogen",
          values: plates.map((plate) =>
            cellForPlate(plate, (ok) => formatPowerKw(ok.snapshot.powerKw)),
          ),
        },
        {
          label: "Actieradius (WLTP)",
          values: plates.map((plate) =>
            cellForPlate(plate, (ok) =>
              formatElectricRange(ok.snapshot.electricRangeKm),
            ),
          ),
        },
      ],
    },
    {
      title: "Uitrusting & opties",
      rows: [
        {
          label: "Stoelverwarming",
          values: plates.map(() => "-"),
        },
        {
          label: "Rijassistentie",
          values: plates.map(() => "-"),
        },
        {
          label: "Navigatie",
          values: plates.map(() => "-"),
        },
        {
          label: "LED verlichting",
          values: plates.map(() => "-"),
        },
      ],
    },
  ];
}

export async function buildComparison(
  formattedKentekens: string[],
): Promise<ComparisonBuildResult> {
  const plates = await Promise.all(
    formattedKentekens.map((kenteken) => fetchPlate(kenteken)),
  );

  return {
    groups: buildGroups(plates),
    plates,
    hasNotFound: plates.some((plate) => plate.status === "not_found"),
    hasErrors: plates.some((plate) => plate.status === "error"),
  };
}
