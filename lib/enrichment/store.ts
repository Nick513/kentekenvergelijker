import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mergeEnrichedSpecs } from "@/lib/enrichment/keywords";
import type {
  EnrichedSpecMap,
  EnrichedSpecValue,
  PlateListingSnapshot,
} from "@/lib/enrichment/types";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function rowToMap(specs: Record<string, EnrichedSpecValue>): EnrichedSpecMap {
  const map: EnrichedSpecMap = new Map();
  for (const [key, value] of Object.entries(specs)) {
    map.set(key, {
      ...value,
      timesFound: value.timesFound ?? 1,
      conflictCount: value.conflictCount ?? 0,
    });
  }
  return map;
}

export async function loadPlateEnrichment(
  licensePlate: string,
): Promise<EnrichedSpecMap | null> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("plate_enrichment_cache")
    .select("specs, fetched_at")
    .eq("license_plate", licensePlate)
    .single();

  if (error || !data) return null;

  if (Date.now() - new Date(data.fetched_at).getTime() > CACHE_TTL_MS) {
    return null;
  }

  return rowToMap(data.specs as Record<string, EnrichedSpecValue>);
}

/** Load existing enrichment bypassing the TTL — used when merging before save. */
async function loadPlateEnrichmentRaw(
  licensePlate: string,
): Promise<EnrichedSpecMap | null> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("plate_enrichment_cache")
    .select("specs")
    .eq("license_plate", licensePlate)
    .single();

  if (error || !data) return null;
  return rowToMap(data.specs as Record<string, EnrichedSpecValue>);
}

export async function savePlateEnrichment(
  licensePlate: string,
  newSpecs: EnrichedSpecMap,
): Promise<void> {
  if (newSpecs.size === 0) return;

  // Merge new findings with whatever we already have in the DB.
  // This means: values not found in this run are preserved, and timesFound
  // increments each time the same value is confirmed by another source.
  // We never discard previously found specs — only timesFound/conflictCount change.
  const existing = await loadPlateEnrichmentRaw(licensePlate);
  const merged = existing ? mergeEnrichedSpecs(existing, newSpecs) : newSpecs;

  const specsObj: Record<string, EnrichedSpecValue> = {};
  for (const [key, value] of merged.entries()) {
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

export async function loadPlateListingSnapshot(
  licensePlate: string,
): Promise<PlateListingSnapshot | null> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("plate_listing_snapshot")
    .select("mileage_km, asking_price_eur, listing_url, last_seen_at")
    .eq("license_plate", licensePlate)
    .single();

  if (error || !data) return null;

  return {
    licensePlate,
    mileageKm: data.mileage_km ?? null,
    askingPriceEur: data.asking_price_eur ?? null,
    listingUrl: data.listing_url ?? null,
    lastSeenAt: data.last_seen_at,
  };
}

export async function savePlateListingSnapshot(
  snapshot: PlateListingSnapshot,
): Promise<void> {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("plate_listing_snapshot")
    .upsert(
      {
        license_plate: snapshot.licensePlate,
        mileage_km: snapshot.mileageKm,
        asking_price_eur: snapshot.askingPriceEur,
        listing_url: snapshot.listingUrl,
        last_seen_at: snapshot.lastSeenAt,
      },
      { onConflict: "license_plate" },
    );

  if (error) {
    throw new Error(`Failed to save plate listing snapshot: ${error.message}`);
  }
}
