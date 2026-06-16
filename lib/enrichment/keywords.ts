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
      timesFound: 1,
      conflictCount: 0,
    };
    specs.set(entry.specKey, value);
  }

  return specs;
}

/**
 * Compare two spec values to decide if they represent the same fact.
 * Cross-type comparison handles ja/nee text vs boolean.
 */
function sameValue(a: EnrichedSpecValue, b: EnrichedSpecValue): boolean {
  // Direct boolean comparison
  if (a.valueBoolean !== null && b.valueBoolean !== null) {
    return a.valueBoolean === b.valueBoolean;
  }
  // Text comparison (normalised)
  if (a.valueText && b.valueText) {
    return normalizeText(a.valueText) === normalizeText(b.valueText);
  }
  // Numeric comparison
  if (a.valueNumeric !== null && b.valueNumeric !== null) {
    return a.valueNumeric === b.valueNumeric;
  }
  // Cross-type: boolean vs ja/nee text
  const boolFromText = (v: EnrichedSpecValue): boolean | null => {
    if (v.valueBoolean !== null) return v.valueBoolean;
    if (!v.valueText) return null;
    const t = normalizeText(v.valueText);
    if (t.startsWith("ja")) return true;
    if (t === "nee") return false;
    return null;
  };
  const bA = boolFromText(a);
  const bB = boolFromText(b);
  if (bA !== null && bB !== null) return bA === bB;
  return false;
}

const VERIFICATION_PRIORITY: Record<string, number> = {
  verified: 4,
  listing_claim_structured: 3,
  listing_claim: 2,
  listing_claim_single: 1.5,
  trim_inferred: 1,
};

export function mergeEnrichedSpecs(
  ...maps: EnrichedSpecMap[]
): EnrichedSpecMap {
  const merged: EnrichedSpecMap = new Map();

  for (const map of maps) {
    for (const [key, incoming] of map.entries()) {
      const timesFoundIn = incoming.timesFound ?? 1;
      const conflictCountIn = incoming.conflictCount ?? 0;

      const existing = merged.get(key);
      if (!existing) {
        merged.set(key, { ...incoming, timesFound: timesFoundIn, conflictCount: conflictCountIn });
        continue;
      }

      const timesFoundEx = existing.timesFound ?? 1;
      const conflictCountEx = existing.conflictCount ?? 0;
      const prioIn = VERIFICATION_PRIORITY[incoming.verification] ?? 0;
      const prioEx = VERIFICATION_PRIORITY[existing.verification] ?? 0;

      if (sameValue(existing, incoming)) {
        // Same value: accumulate confirmations, keep the higher-trust source
        if (prioIn > prioEx) {
          merged.set(key, {
            ...incoming,
            timesFound: timesFoundEx + timesFoundIn,
            conflictCount: conflictCountEx + conflictCountIn,
          });
        } else {
          merged.set(key, {
            ...existing,
            timesFound: timesFoundEx + timesFoundIn,
            conflictCount: conflictCountEx + conflictCountIn,
          });
        }
      } else {
        // Conflicting values: higher priority (or more votes on tie) wins
        const incomingWins =
          prioIn > prioEx ||
          (prioIn === prioEx && timesFoundIn > timesFoundEx);

        if (incomingWins) {
          merged.set(key, {
            ...incoming,
            timesFound: timesFoundIn,
            conflictCount: conflictCountEx + conflictCountIn + timesFoundEx,
          });
        } else {
          merged.set(key, {
            ...existing,
            timesFound: timesFoundEx,
            conflictCount: conflictCountEx + conflictCountIn + timesFoundIn,
          });
        }
      }
    }
  }

  return merged;
}
