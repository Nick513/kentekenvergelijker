import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { EnrichedSpecMap, EnrichedSpecValue, SpecVerification } from "@/lib/enrichment/types";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

type PlateSpecRow = {
  license_plate: string;
  spec_key: string;
  value_text: string | null;
  value_numeric: number | null;
  value_boolean: boolean | null;
  source: string;
  verification: SpecVerification;
  listing_url: string | null;
  fetched_at: string;
};

function rowToValue(row: PlateSpecRow): EnrichedSpecValue {
  return {
    valueText: row.value_text,
    valueNumeric: row.value_numeric === null ? null : Number(row.value_numeric),
    valueBoolean: row.value_boolean,
    verification: row.verification,
    source: row.source,
    listingUrl: row.listing_url,
  };
}

export async function loadPlateEnrichment(
  licensePlate: string,
): Promise<EnrichedSpecMap | null> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("plate_specification_values")
    .select(
      "license_plate, spec_key, value_text, value_numeric, value_boolean, source, verification, listing_url, fetched_at",
    )
    .eq("license_plate", licensePlate);

  if (error || !data || data.length === 0) {
    return null;
  }

  const fetchedAt = new Date((data[0] as PlateSpecRow).fetched_at).getTime();
  if (Date.now() - fetchedAt > CACHE_TTL_MS) {
    return null;
  }

  const map: EnrichedSpecMap = new Map();
  for (const row of data as PlateSpecRow[]) {
    map.set(row.spec_key, rowToValue(row));
  }
  return map;
}

export async function savePlateEnrichment(
  licensePlate: string,
  specs: EnrichedSpecMap,
): Promise<void> {
  if (specs.size === 0) {
    return;
  }

  const supabase = createSupabaseServerClient();
  const rows = [...specs.entries()].map(([specKey, value]) => ({
    license_plate: licensePlate,
    spec_key: specKey,
    value_text: value.valueText,
    value_numeric: value.valueNumeric,
    value_boolean: value.valueBoolean,
    source: value.source,
    verification: value.verification,
    listing_url: value.listingUrl ?? null,
    fetched_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from("plate_specification_values")
    .upsert(rows, { onConflict: "license_plate,spec_key" });

  if (error) {
    throw new Error(`Failed to save plate enrichment: ${error.message}`);
  }
}

