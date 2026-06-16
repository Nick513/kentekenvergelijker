import equipmentKeywords from "@/lib/enrichment/equipment-keywords.json";
import type { EnrichedSpecMap, EnrichedSpecValue } from "@/lib/enrichment/types";

type KeywordEntry = {
  match: string[];
  specKey: string;
};

const KEYWORDS = (equipmentKeywords.keywords ?? []) as KeywordEntry[];

// Dutch (and common English) negation words that can precede a feature mention
// to mean the feature is absent: "geen adaptieve cruise control" = no ACC.
const NEGATION_RE = /\b(geen|niet|zonder|nooit|nimmer|non|no|not)\b/;
const NEGATION_WINDOW = 60;

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

/** True when a negation word appears within NEGATION_WINDOW chars before matchIndex. */
function isNegated(text: string, matchIndex: number): boolean {
  const before = text.slice(Math.max(0, matchIndex - NEGATION_WINDOW), matchIndex);
  return NEGATION_RE.test(before);
}

export function extractEquipmentFromText(
  text: string,
  source: string,
  listingUrl?: string | null,
): EnrichedSpecMap {
  const normalized = normalizeText(text);
  const specs: EnrichedSpecMap = new Map();

  for (const entry of KEYWORDS) {
    let matched = false;

    outer: for (const keyword of entry.match) {
      const kw = normalizeText(keyword);
      let searchFrom = 0;

      while (true) {
        const idx = normalized.indexOf(kw, searchFrom);
        if (idx === -1) break;
        if (!isNegated(normalized, idx)) {
          matched = true;
          break outer;
        }
        searchFrom = idx + kw.length;
      }
    }

    if (!matched) continue;

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
    listing_claim_single: 1.5,
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
