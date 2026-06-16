import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { EnrichedSpecMap, EnrichedSpecValue } from "@/lib/enrichment/types";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export async function loadPlateEnrichment(
  licensePlate: string,
): Promise<EnrichedSpecMap | null> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("plate_enrichment_cache")
    .select("specs, fetched_at")
    .eq("license_plate", licensePlate)
    .single();

  if (error || !data) {
    return null;
  }

  if (Date.now() - new Date(data.fetched_at).getTime() > CACHE_TTL_MS) {
    return null;
  }

  const map: EnrichedSpecMap = new Map();
  for (const [key, value] of Object.entries(data.specs as Record<string, EnrichedSpecValue>)) {
    map.set(key, value);
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

  const specsObj: Record<string, EnrichedSpecValue> = {};
  for (const [key, value] of specs.entries()) {
    specsObj[key] = value;
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("plate_enrichment_cache")
    .upsert(
      { license_plate: licensePlate, specs: specsObj, fetched_at: new Date().toISOString() },
      { onConflict: "license_plate" },
    );

  if (error) {
    throw new Error(`Failed to save plate enrichment: ${error.message}`);
  }
}
