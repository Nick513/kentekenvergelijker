export type SpecVerification = "verified" | "listing_claim_structured" | "listing_claim" | "trim_inferred";

export type EnrichedSpecValue = {
  valueText: string | null;
  valueNumeric: number | null;
  valueBoolean: boolean | null;
  verification: SpecVerification;
  source: string;
  listingUrl?: string | null;
};

export type EnrichedSpecMap = Map<string, EnrichedSpecValue>;

export type ListingSearchResult = {
  found: boolean;
  listingUrl: string | null;
  title: string | null;
  descriptionText: string;
  source: string;
  mileageKm: number | null;
  askingPriceEur: number | null;
};

export type ListingEnrichmentResult = {
  specs: EnrichedSpecMap;
  mileageKm: number | null;
  askingPriceEur: number | null;
};

export type PlateEnrichmentResult = {
  licensePlate: string;
  specs: EnrichedSpecMap;
  fetchedAt: string;
};

export type PlateListingSnapshot = {
  licensePlate: string;
  mileageKm: number | null;
  askingPriceEur: number | null;
  listingUrl: string | null;
  lastSeenAt: string;
};
