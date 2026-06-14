export type SpecificationValueSource = "rdw" | "equipment" | "unavailable";

export type SpecificationDisplayType =
  | "text"
  | "boolean"
  | "currency"
  | "date"
  | "power_kw"
  | "distance_km"
  | "mass_kg"
  | "volume_cc"
  | "year"
  | "length_cm"
  | "co2_g_km";

export type ComparisonSpecification = {
  specKey: string;
  groupKey: string;
  groupLabel: string;
  groupSortOrder: number;
  label: string;
  sortOrder: number;
  valueSource: SpecificationValueSource;
  valueKey: string;
  displayType: SpecificationDisplayType;
  isActive: boolean;
};

export type ComparisonSpecificationRow = {
  spec_key: string;
  group_key: string;
  group_label: string;
  group_sort_order: number;
  label: string;
  sort_order: number;
  value_source: SpecificationValueSource;
  value_key: string;
  display_type: SpecificationDisplayType;
  is_active: boolean;
};
