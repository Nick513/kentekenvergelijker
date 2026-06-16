import registry from "@/lib/vehicles/brand-registry.json";

export type BrandTier = "active" | "legacy_rare";
export type BrandMarketStatus =
  | "current"
  | "discontinued"
  | "exited_nl"
  | "exited_eu"
  | "niche"
  | "unclassified";

export type BrandRegistryEntry = {
  canonical: string;
  tier: BrandTier;
  marketStatus: BrandMarketStatus;
  notes: string | null;
  rdwMerken: string[];
  registeredCount: number;
};

export type BrandRegistry = {
  version: number;
  generatedAt: string;
  source: {
    dataset: string;
    filter: string;
    minCount: number;
  };
  summary: {
    activeBrandCount: number;
    legacyRareBrandCount: number;
    legacyRareOnRoadCount: number;
    rdwUnclassifiedCount: number;
    totalRdwMerken: number;
  };
  active: BrandRegistryEntry[];
  legacyRare: BrandRegistryEntry[];
  rdwUnclassified: Array<{ rdwMerk: string; registeredCount: number }>;
};

const data = registry as BrandRegistry;

const rdwMerkIndex = new Map<string, BrandRegistryEntry>();

for (const entry of [...data.active, ...data.legacyRare]) {
  for (const merk of entry.rdwMerken) {
    rdwMerkIndex.set(merk.toUpperCase(), entry);
  }
  rdwMerkIndex.set(entry.canonical.toUpperCase(), entry);
}

/** Lookup a brand entry by RDW merk or canonical name (case-insensitive). */
export function findBrandByRdwMerk(merk: string | null | undefined): BrandRegistryEntry | null {
  if (!merk?.trim()) return null;
  return rdwMerkIndex.get(merk.trim().toUpperCase()) ?? null;
}

/** Return canonical display name for an RDW merk when known; otherwise the raw merk. */
export function resolveCanonicalBrand(merk: string | null | undefined): string {
  if (!merk?.trim()) return "Onbekend";
  return findBrandByRdwMerk(merk)?.canonical ?? merk.trim();
}

export function isLegacyRareBrand(merk: string | null | undefined): boolean {
  return findBrandByRdwMerk(merk)?.tier === "legacy_rare";
}

export function getBrandRegistry(): BrandRegistry {
  return data;
}

export function getLegacyRareBrands(): BrandRegistryEntry[] {
  return data.legacyRare;
}

export function getActiveBrands(): BrandRegistryEntry[] {
  return data.active;
}
