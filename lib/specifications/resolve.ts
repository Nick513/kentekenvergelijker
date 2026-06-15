import type { ComparisonCellValue } from "@/components/comparison-table";
import type { ComparisonGroup } from "@/components/comparison-table";
import {
  formatApkDate,
  formatBrandModel,
  formatCatalogPrice,
  formatCo2Emission,
  formatCount,
  formatElectricConsumption,
  formatElectricRange,
  formatLengthCm,
  formatMassKg,
  formatPowerKw,
  formatVolumeCc,
  formatYear,
} from "@/lib/rdw/map";
import type { PlateFetchResult } from "@/lib/rdw/types";
import type { CatalogSpecMap, CatalogSpecValue } from "@/lib/vehicles/catalog";
import type {
  ComparisonSpecification,
  SpecificationDisplayType,
} from "@/lib/specifications/types";

const UNAVAILABLE = "-";

function unavailableCell(): ComparisonCellValue {
  return UNAVAILABLE;
}

function formatCatalogValue(
  displayType: SpecificationDisplayType,
  value: CatalogSpecValue,
): ComparisonCellValue {
  switch (displayType) {
    case "boolean":
      // Omit-if-unknown: only true is shown; absence stays "-", never "Nee".
      return value.valueBoolean === true ? true : unavailableCell();
    case "currency":
      return formatCatalogPrice(value.valueNumeric);
    case "power_kw":
      return formatPowerKw(value.valueNumeric);
    case "distance_km":
      return formatElectricRange(value.valueNumeric);
    case "mass_kg":
      return formatMassKg(value.valueNumeric);
    case "volume_cc":
      return formatVolumeCc(value.valueNumeric);
    case "length_cm":
      return formatLengthCm(value.valueNumeric);
    case "co2_g_km":
      return formatCo2Emission(value.valueNumeric);
    case "year":
      return formatYear(value.valueNumeric);
    case "date":
      return value.valueText ?? unavailableCell();
    default:
      if (value.valueText) return value.valueText;
      if (value.valueNumeric !== null) return String(value.valueNumeric);
      return unavailableCell();
  }
}

function resolveRdwValue(
  valueKey: string,
  plate: PlateFetchResult & { status: "ok" },
): ComparisonCellValue {
  const snapshot = plate.snapshot;

  switch (valueKey) {
    case "brand_model":
      return formatBrandModel(snapshot);
    case "primary_color":
      return snapshot.primaryColor ?? "-";
    case "first_registration_year":
      return formatYear(snapshot.firstRegistrationYear);
    case "apk_expiry_date":
      return formatApkDate(snapshot.apkExpiryDate);
    case "catalog_price":
      return formatCatalogPrice(snapshot.catalogPrice);
    case "vehicle_type":
      return snapshot.vehicleType ?? "-";
    case "body_type":
      return snapshot.bodyType ?? "-";
    case "door_count":
      return formatCount(snapshot.doorCount);
    case "seat_count":
      return formatCount(snapshot.seatCount);
    case "vehicle_length_cm":
      return formatLengthCm(snapshot.vehicleLengthCm);
    case "vehicle_width_cm":
      return formatLengthCm(snapshot.vehicleWidthCm);
    case "vehicle_height_cm":
      return formatLengthCm(snapshot.vehicleHeightCm);
    case "wheelbase_cm":
      return formatLengthCm(snapshot.wheelbaseCm);
    case "curb_weight_kg":
      return formatMassKg(snapshot.curbWeightKg);
    case "empty_weight_kg":
      return formatMassKg(snapshot.emptyWeightKg);
    case "max_towing_weight_braked_kg":
      return formatMassKg(snapshot.maxTowingWeightBrakedKg);
    case "fuel_type":
      return snapshot.fuelType ?? "-";
    case "power_kw":
      return formatPowerKw(snapshot.powerKw);
    case "engine_displacement_cc":
      return formatVolumeCc(snapshot.engineDisplacementCc);
    case "cylinder_count":
      return formatCount(snapshot.cylinderCount);
    case "electric_range_wltp":
      return formatElectricRange(snapshot.electricRangeKm);
    case "electric_consumption_wltp":
      return formatElectricConsumption(snapshot.electricConsumptionWltp);
    case "co2_emission_g_km":
      return formatCo2Emission(snapshot.co2EmissionGKm);
    case "emission_standard":
      return snapshot.emissionStandard ?? "-";
    default:
      return "-";
  }
}

function resolvePlateValue(
  spec: ComparisonSpecification,
  plate: PlateFetchResult,
  catalog: CatalogSpecMap | null,
): ComparisonCellValue {
  if (plate.status === "not_found") {
    return spec.displayType === "boolean" ? unavailableCell() : "Niet gevonden";
  }

  if (plate.status === "error") {
    return unavailableCell();
  }

  const catalogValue = catalog?.get(spec.specKey) ?? null;

  if (spec.valueSource === "rdw") {
    const rdwValue = resolveRdwValue(spec.valueKey, plate);
    // Live RDW wins; catalog only fills a gap when RDW has no value.
    if (rdwValue === UNAVAILABLE && catalogValue) {
      return formatCatalogValue(spec.displayType, catalogValue);
    }
    return rdwValue;
  }

  if (spec.valueSource === "catalog" || spec.valueSource === "equipment") {
    if (catalogValue) {
      return formatCatalogValue(spec.displayType, catalogValue);
    }
    return unavailableCell();
  }

  return unavailableCell();
}

export function buildComparisonGroups(
  specifications: ComparisonSpecification[],
  plates: PlateFetchResult[],
  catalogs: (CatalogSpecMap | null)[] = [],
): ComparisonGroup[] {
  const groups = new Map<string, ComparisonGroup>();

  for (const spec of specifications) {
    const existing = groups.get(spec.groupKey);

    const row = {
      label: spec.label,
      values: plates.map((plate, index) =>
        resolvePlateValue(spec, plate, catalogs[index] ?? null),
      ),
    };

    if (existing) {
      existing.rows.push(row);
      continue;
    }

    groups.set(spec.groupKey, {
      title: spec.groupLabel,
      rows: [row],
    });
  }

  return [...groups.values()];
}
