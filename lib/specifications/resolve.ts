import type { ComparisonCell, ComparisonGroup } from "@/components/comparison-table";
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
import type { EnrichedSpecMap, EnrichedSpecValue } from "@/lib/enrichment/types";
import { isUnverifiedForDisplay } from "@/lib/enrichment/verification";
import type { PlateFetchResult } from "@/lib/rdw/types";
import type { CatalogSpecMap, CatalogSpecValue } from "@/lib/vehicles/catalog";
import type {
  ComparisonSpecification,
  SpecificationDisplayType,
} from "@/lib/specifications/types";

const UNAVAILABLE = "-";

function unavailableCell(): ComparisonCell {
  return { value: UNAVAILABLE, verification: null };
}

function cellFromValue(
  value: ComparisonCell["value"],
  verification: ComparisonCell["verification"] = null,
): ComparisonCell {
  return { value, verification };
}

function formatCatalogValue(
  displayType: SpecificationDisplayType,
  value: CatalogSpecValue | EnrichedSpecValue,
): ComparisonCell["value"] {
  switch (displayType) {
    case "boolean":
      return value.valueBoolean === true ? true : UNAVAILABLE;
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
      return value.valueText ?? UNAVAILABLE;
    default:
      if (value.valueText) return value.valueText;
      if (value.valueNumeric !== null) return String(value.valueNumeric);
      return UNAVAILABLE;
  }
}

function resolveRdwValue(
  valueKey: string,
  plate: PlateFetchResult & { status: "ok" },
): ComparisonCell {
  const snapshot = plate.snapshot;

  let value: ComparisonCell["value"];
  switch (valueKey) {
    case "brand_model":
      value = formatBrandModel(snapshot);
      break;
    case "primary_color":
      value = snapshot.primaryColor ?? UNAVAILABLE;
      break;
    case "first_registration_year":
      value = formatYear(snapshot.firstRegistrationYear);
      break;
    case "apk_expiry_date":
      value = formatApkDate(snapshot.apkExpiryDate);
      break;
    case "catalog_price":
      value = formatCatalogPrice(snapshot.catalogPrice);
      break;
    case "vehicle_type":
      value = snapshot.vehicleType ?? UNAVAILABLE;
      break;
    case "body_type":
      value = snapshot.bodyType ?? UNAVAILABLE;
      break;
    case "door_count":
      value = formatCount(snapshot.doorCount);
      break;
    case "seat_count":
      value = formatCount(snapshot.seatCount);
      break;
    case "vehicle_length_cm":
      value = formatLengthCm(snapshot.vehicleLengthCm);
      break;
    case "vehicle_width_cm":
      value = formatLengthCm(snapshot.vehicleWidthCm);
      break;
    case "vehicle_height_cm":
      value = formatLengthCm(snapshot.vehicleHeightCm);
      break;
    case "wheelbase_cm":
      value = formatLengthCm(snapshot.wheelbaseCm);
      break;
    case "curb_weight_kg":
      value = formatMassKg(snapshot.curbWeightKg);
      break;
    case "empty_weight_kg":
      value = formatMassKg(snapshot.emptyWeightKg);
      break;
    case "max_towing_weight_braked_kg":
      value = formatMassKg(snapshot.maxTowingWeightBrakedKg);
      break;
    case "fuel_type":
      value = snapshot.fuelType ?? UNAVAILABLE;
      break;
    case "power_kw":
      value = formatPowerKw(snapshot.powerKw);
      break;
    case "engine_displacement_cc":
      value = formatVolumeCc(snapshot.engineDisplacementCc);
      break;
    case "cylinder_count":
      value = formatCount(snapshot.cylinderCount);
      break;
    case "electric_range_wltp":
      value = formatElectricRange(snapshot.electricRangeKm);
      break;
    case "electric_consumption_wltp":
      value = formatElectricConsumption(snapshot.electricConsumptionWltp);
      break;
    case "co2_emission_g_km":
      value = formatCo2Emission(snapshot.co2EmissionGKm);
      break;
    case "emission_standard":
      value = snapshot.emissionStandard ?? UNAVAILABLE;
      break;
    default:
      value = UNAVAILABLE;
  }

  return cellFromValue(value, value === UNAVAILABLE ? null : "verified");
}

function resolvePlateValue(
  spec: ComparisonSpecification,
  plate: PlateFetchResult,
  enriched: EnrichedSpecMap | null,
  catalog: CatalogSpecMap | null,
): ComparisonCell {
  if (plate.status === "not_found") {
    return cellFromValue(
      spec.displayType === "boolean" ? UNAVAILABLE : "Niet gevonden",
    );
  }

  if (plate.status === "error") {
    return unavailableCell();
  }

  const enrichedValue = enriched?.get(spec.specKey) ?? null;
  const catalogValue = catalog?.get(spec.specKey) ?? null;

  if (spec.valueSource === "rdw") {
    const rdwCell = resolveRdwValue(spec.valueKey, plate);
    if (rdwCell.value !== UNAVAILABLE) {
      return rdwCell;
    }

    const fallback = enrichedValue ?? catalogValue;
    if (fallback) {
      const formatted = formatCatalogValue(spec.displayType, fallback);
      const verification =
        enrichedValue?.verification ??
        (catalogValue ? "trim_inferred" : null);
      return cellFromValue(formatted, verification);
    }

    return rdwCell;
  }

  if (spec.valueSource === "catalog" || spec.valueSource === "equipment") {
    if (enrichedValue) {
      const formatted = formatCatalogValue(spec.displayType, enrichedValue);
      if (formatted === UNAVAILABLE && spec.displayType === "boolean") {
        return unavailableCell();
      }
      return cellFromValue(formatted, enrichedValue.verification);
    }

    if (catalogValue) {
      const formatted = formatCatalogValue(spec.displayType, catalogValue);
      if (formatted === UNAVAILABLE && spec.displayType === "boolean") {
        return unavailableCell();
      }
      return cellFromValue(formatted, "trim_inferred");
    }

    return unavailableCell();
  }

  return unavailableCell();
}

export function buildComparisonGroups(
  specifications: ComparisonSpecification[],
  plates: PlateFetchResult[],
  enrichedMaps: (EnrichedSpecMap | null)[] = [],
  catalogs: (CatalogSpecMap | null)[] = [],
): ComparisonGroup[] {
  const groups = new Map<string, ComparisonGroup>();

  for (const spec of specifications) {
    const existing = groups.get(spec.groupKey);

    const row = {
      label: spec.label,
      values: plates.map((plate, index) =>
        resolvePlateValue(
          spec,
          plate,
          enrichedMaps[index] ?? null,
          catalogs[index] ?? null,
        ),
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

export function rowHasUnverifiedValues(row: { values: ComparisonCell[] }): boolean {
  return row.values.some(
    (cell) =>
      cell.verification !== null &&
      cell.verification !== undefined &&
      isUnverifiedForDisplay(cell.verification) &&
      cell.value !== UNAVAILABLE &&
      cell.value !== false,
  );
}

export function filterEmptyComparisonGroups(
  groups: ComparisonGroup[],
): ComparisonGroup[] {
  return groups
    .map((group) => ({
      ...group,
      rows: group.rows.filter((row) =>
        row.values.some((cell) => cell.value !== UNAVAILABLE),
      ),
    }))
    .filter((group) => group.rows.length > 0);
}
