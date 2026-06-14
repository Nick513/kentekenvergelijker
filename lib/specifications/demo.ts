import type { ComparisonGroup } from "@/components/comparison-table";
import type { ComparisonSpecification } from "@/lib/specifications/types";

const DEMO_VALUES: Record<string, [string | boolean, string | boolean]> = {
  brand_model: ["Volkswagen Golf", "Volkswagen Golf"],
  trim_package: ["Life", "Style"],
  first_registration_year: ["2019", "2021"],
  fuel_type: ["Benzine", "Benzine"],
  power_kw: ["110 pk", "130 pk"],
  heated_seats: [false, true],
  adaptive_cruise_control: [false, true],
  navigation: [true, true],
  led_headlights: [false, true],
  parking_sensors_rear: [true, true],
  parking_sensors_front: [false, true],
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
