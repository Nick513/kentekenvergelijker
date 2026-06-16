import equipmentKeywords from "@/lib/enrichment/equipment-keywords.json";
import type { EnrichedSpecMap, EnrichedSpecValue } from "@/lib/enrichment/types";

type KeywordEntry = {
  match: string[];
  specKey: string;
};

const KEYWORDS = (equipmentKeywords.keywords ?? []) as KeywordEntry[];

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

export function extractEquipmentFromText(
  text: string,
  source: string,
  listingUrl?: string | null,
): EnrichedSpecMap {
  const normalized = normalizeText(text);
  const specs: EnrichedSpecMap = new Map();

  for (const entry of KEYWORDS) {
    const hit = entry.match.some((keyword) =>
      normalized.includes(normalizeText(keyword)),
    );
    if (!hit) {
      continue;
    }

    const value: EnrichedSpecValue = {
      valueText: null,
      valueNumeric: null,
      valueBoolean: true,
      verification: "listing_claim",
      source,
      listingUrl: listingUrl ?? null,
    };
    specs.set(entry.specKey, value);
  }

  return specs;
}

export function mergeEnrichedSpecs(
  ...maps: EnrichedSpecMap[]
): EnrichedSpecMap {
  const merged: EnrichedSpecMap = new Map();
  const priority: Record<string, number> = {
    verified: 4,
    listing_claim_structured: 3,
    listing_claim: 2,
    trim_inferred: 1,
  };

  for (const map of maps) {
    for (const [key, value] of map.entries()) {
      const existing = merged.get(key);
      if (!existing || priority[value.verification] > priority[existing.verification]) {
        merged.set(key, value);
      }
    }
  }

  return merged;
}
