import type { ComparisonCell, ComparisonGroup } from "@/components/comparison-table";
import type { ComparisonSpecification } from "@/lib/specifications/types";

const DEMO_VALUES: Record<string, [ComparisonCell, ComparisonCell]> = {
  brand_model: [
    { value: "Volkswagen Golf", verification: "verified" },
    { value: "Volkswagen Golf", verification: "verified" },
  ],
  trim_package: [
    { value: "Life", verification: "trim_inferred" },
    { value: "Style", verification: "trim_inferred" },
  ],
  first_registration_year: [
    { value: "2019", verification: "verified" },
    { value: "2021", verification: "verified" },
  ],
  fuel_type: [
    { value: "Benzine", verification: "verified" },
    { value: "Benzine", verification: "verified" },
  ],
  power_kw: [
    { value: "110 pk", verification: "verified" },
    { value: "130 pk", verification: "verified" },
  ],
  heated_seats: [
    { value: false, verification: null },
    { value: true, verification: "listing_claim" },
  ],
  adaptive_cruise_control: [
    { value: false, verification: null },
    { value: true, verification: "listing_claim" },
  ],
  navigation: [
    { value: true, verification: "trim_inferred" },
    { value: true, verification: "trim_inferred" },
  ],
  led_headlights: [
    { value: false, verification: null },
    { value: true, verification: "listing_claim" },
  ],
  parking_sensors_rear: [
    { value: true, verification: "trim_inferred" },
    { value: true, verification: "trim_inferred" },
  ],
  parking_sensors_front: [
    { value: false, verification: null },
    { value: true, verification: "listing_claim" },
  ],
};

export function buildDemoComparisonGroups(
  specifications: ComparisonSpecification[],
): ComparisonGroup[] {
  const groups = new Map<string, ComparisonGroup>();

  for (const spec of specifications) {
    const demoValues = DEMO_VALUES[spec.valueKey];
    if (!demoValues) {
      continue;
    }

    const row = {
      label: spec.label,
      values: [...demoValues],
    };

    const existing = groups.get(spec.groupKey);
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
