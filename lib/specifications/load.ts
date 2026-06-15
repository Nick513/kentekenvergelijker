import { unstable_cache } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  ComparisonSpecification,
  ComparisonSpecificationRow,
} from "@/lib/specifications/types";

const CACHE_TTL_SECONDS = 3600;

function mapRow(row: ComparisonSpecificationRow): ComparisonSpecification {
  return {
    specKey: row.spec_key,
    groupKey: row.group_key,
    groupLabel: row.group_label,
    groupSortOrder: row.group_sort_order,
    label: row.label,
    sortOrder: row.sort_order,
    valueSource: row.value_source,
    valueKey: row.value_key,
    displayType: row.display_type,
    isActive: row.is_active,
  };
}

async function fetchComparisonSpecifications(): Promise<ComparisonSpecification[]> {
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from("specifications")
    .select(
      "spec_key, group_key, group_label, group_sort_order, label, sort_order, value_source, value_key, display_type, is_active",
    )
    .eq("is_active", true)
    .order("group_sort_order", { ascending: true })
    .order("sort_order", { ascending: true });

  if (error) {
    throw new Error(`Failed to load comparison specifications: ${error.message}`);
  }

  return (data ?? []).map((row) =>
    mapRow(row as ComparisonSpecificationRow),
  );
}

export async function loadComparisonSpecifications(): Promise<
  ComparisonSpecification[]
> {
  return unstable_cache(
    fetchComparisonSpecifications,
    ["comparison-specifications"],
    { revalidate: CACHE_TTL_SECONDS },
  )();
}
