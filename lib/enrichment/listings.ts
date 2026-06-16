import * as cheerio from "cheerio";
import { fetchHtml } from "@/lib/enrichment/fetch-html";
import { extractEquipmentFromText } from "@/lib/enrichment/keywords";
import type {
  EnrichedSpecMap,
  ListingEnrichmentResult,
  ListingSearchResult,
} from "@/lib/enrichment/types";
import { formatKenteken, normalizeKenteken } from "@/lib/kenteken";

const GASPEDAAL_BASE = "https://www.gaspedaal.nl";

/**
 * Extract listing-relevant text from a detail page.
 * Strips navigation, headers, footers, and sidebars so that keyword matching
 * only fires on the actual vehicle description — not on menu items, filter chips,
 * or related-car sidebars that can introduce false positives.
 */
function extractListingBodyText(html: string): string {
  const $ = cheerio.load(html);

  // Remove chrome/boilerplate areas first.
  $(
    "nav, header, footer, aside, " +
    "[role='navigation'], [role='menu'], [role='menubar'], " +
    "[role='banner'], [role='complementary'], " +
    "[class*='menu'], [class*='Menu'], [class*='nav'], [class*='Nav'], " +
    "[class*='sidebar'], [class*='Sidebar'], " +
    "[class*='related'], [class*='Related'], " +
    "[class*='recommendation'], [class*='Recommendation'], " +
    "script, style",
  ).remove();

  // Prefer a focused content container when one is present.
  const contentSelectors = [
    "main",
    "article",
    '[class*="description"]',
    '[class*="Description"]',
    '[class*="omschrijving"]',
    '[class*="Omschrijving"]',
    '[class*="listing-detail"]',
    '[class*="ListingDetail"]',
    '[class*="vehicle-detail"]',
    '[class*="VehicleDetail"]',
    '[class*="car-detail"]',
    '[class*="CarDetail"]',
    '[class*="content"]',
    '[class*="Content"]',
  ];

  for (const sel of contentSelectors) {
    const text = $(sel).text().trim();
    if (text.length > 100) return text;
  }

  return $("body").text();
}

function plateVariants(licensePlate: string): string[] {
  const normalized = normalizeKenteken(licensePlate);
  const formatted = formatKenteken(normalized);
  return [...new Set([normalized, formatted, normalized.toLowerCase(), formatted.toLowerCase()])];
}

function textContainsPlate(text: string, variants: string[]): boolean {
  const haystack = text.replace(/[-\s]/g, "").toLowerCase();
  return variants.some((variant) =>
    haystack.includes(variant.replace(/[-\s]/g, "").toLowerCase()),
  );
}

function extractJsonLdVehicles(html: string): Record<string, unknown>[] {
  const $ = cheerio.load(html);
  const vehicles: Record<string, unknown>[] = [];

  $('script[type="application/ld+json"]').each((_, element) => {
    const raw = $(element).contents().text();
    if (!raw) return;

    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      return;
    }

    const nodes = Array.isArray(data) ? data : [data];
    for (const node of nodes) {
      if (!node || typeof node !== "object") continue;
      const record = node as Record<string, unknown>;
      const nodeTypes = (Array.isArray(record["@type"]) ? record["@type"] : [record["@type"]]) as string[];

      if (nodeTypes.includes("Car")) {
        vehicles.push(record);
      }

      if (nodeTypes.includes("ItemList") && Array.isArray(record.itemListElement)) {
        for (const entry of record.itemListElement as Record<string, unknown>[]) {
          const item = entry.item as Record<string, unknown> | undefined;
          const itemTypes = (Array.isArray(item?.["@type"]) ? item?.["@type"] : [item?.["@type"]]) as string[];
          if (itemTypes.includes("Car")) {
            vehicles.push(item!);
          }
        }
      }
    }
  });

  return vehicles;
}

function extractMileageKm(vehicle: Record<string, unknown>): number | null {
  const raw = vehicle.mileageFromOdometer;
  if (typeof raw === "number") return raw > 0 && raw < 2_000_000 ? Math.round(raw) : null;
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    const val = typeof obj.value === "number"
      ? obj.value
      : parseFloat(String(obj.value ?? "").replace(/\./g, "").replace(",", "."));
    if (!isNaN(val) && val > 0 && val < 2_000_000) {
      const unit = (obj.unitCode as string | undefined)?.toUpperCase();
      return Math.round(unit === "SMI" ? val * 1.60934 : val);
    }
  }
  return null;
}

function extractPriceEur(vehicle: Record<string, unknown>): number | null {
  const offers = vehicle.offers as Record<string, unknown> | undefined;
  if (!offers) return null;
  const currency = offers.priceCurrency as string | undefined;
  if (currency && currency.toUpperCase() !== "EUR") return null;
  const raw = offers.price;
  let price: number;
  if (typeof raw === "number") {
    price = raw;
  } else if (typeof raw === "string") {
    price = parseFloat(raw.replace(/\./g, "").replace(",", "."));
  } else {
    return null;
  }
  return !isNaN(price) && price > 0 && price < 10_000_000 ? Math.round(price) : null;
}

function findListingUrl(html: string, variants: string[]): string | null {
  const $ = cheerio.load(html);
  let best: string | null = null;

  $("a[href]").each((_, element) => {
    const href = $(element).attr("href") ?? "";
    const text = $(element).text();
    const combined = `${href} ${text}`;
    if (!textContainsPlate(combined, variants)) {
      return;
    }

    if (href.includes("/auto/") || href.includes("/occasion")) {
      const absolute = href.startsWith("http") ? href : `${GASPEDAAL_BASE}${href}`;
      best = absolute;
    }
  });

  return best;
}

function vehicleToText(vehicle: Record<string, unknown>): string {
  const parts = [
    vehicle.name,
    vehicle.description,
    vehicle.vehicleConfiguration,
    vehicle.color,
  ];
  return parts.filter((part) => typeof part === "string").join(" ");
}

async function searchGaspedaal(licensePlate: string): Promise<ListingSearchResult | null> {
  const variants = plateVariants(licensePlate);
  const normalized = normalizeKenteken(licensePlate);

  const searchUrls = [
    `${GASPEDAAL_BASE}/zoeken?kenteken=${normalized}`,
    `${GASPEDAAL_BASE}/zoeken?trefw=${encodeURIComponent(normalized)}`,
    `${GASPEDAAL_BASE}/zoeken?trefw=${encodeURIComponent(formatKenteken(normalized))}`,
  ];

  for (const url of searchUrls) {
    const html = await fetchHtml(url, { referer: "https://www.google.nl/" });
    if (!html) continue;

    if (!textContainsPlate(html, variants)) {
      continue;
    }

    const vehicles = extractJsonLdVehicles(html);
    const matchedVehicle = vehicles.find((vehicle) =>
      textContainsPlate(vehicleToText(vehicle), variants),
    );

    const listingUrl = findListingUrl(html, variants);
    let title =
      typeof matchedVehicle?.name === "string" ? matchedVehicle.name : null;
    let descriptionText = matchedVehicle ? vehicleToText(matchedVehicle) : "";
    // Use the first Car node for market data — the kenteken search guarantees it's the right car,
    // even if the plate text doesn't appear in the vehicle name/description fields.
    const marketVehicle = matchedVehicle ?? vehicles[0] ?? null;
    let mileageKm = marketVehicle ? extractMileageKm(marketVehicle) : null;
    let askingPriceEur = marketVehicle ? extractPriceEur(marketVehicle) : null;

    if (listingUrl) {
      const detailHtml = await fetchHtml(listingUrl, { referer: url });
      if (detailHtml) {
        descriptionText = extractListingBodyText(detailHtml);
        const detailVehicles = extractJsonLdVehicles(detailHtml);
        const detailVehicle = detailVehicles[0];
        if (detailVehicle) {
          title =
            typeof detailVehicle.name === "string" ? detailVehicle.name : title;
          descriptionText = `${descriptionText} ${vehicleToText(detailVehicle)}`;
          mileageKm ??= extractMileageKm(detailVehicle);
          askingPriceEur ??= extractPriceEur(detailVehicle);
        }
      }
    } else if (!descriptionText) {
      descriptionText = extractListingBodyText(html);
    }

    return {
      found: true,
      listingUrl,
      title,
      descriptionText,
      source: "listing_gaspedaal",
      mileageKm,
      askingPriceEur,
    };
  }

  return null;
}

async function searchAutotrack(licensePlate: string): Promise<ListingSearchResult | null> {
  const normalized = normalizeKenteken(licensePlate);
  const variants = plateVariants(licensePlate);
  const url = `https://www.autotrack.nl/aanbod?kenteken=${normalized}`;
  const html = await fetchHtml(url, { referer: "https://www.google.nl/" });

  if (!html || !textContainsPlate(html, variants)) {
    return null;
  }

  const listingUrl = findListingUrl(
    html.replaceAll("autotrack.nl", "www.autotrack.nl"),
    variants,
  );
  let descriptionText = extractListingBodyText(html);
  let mileageKm: number | null = null;
  let askingPriceEur: number | null = null;

  if (listingUrl) {
    const detailHtml = await fetchHtml(listingUrl, { referer: url });
    if (detailHtml) {
      descriptionText = extractListingBodyText(detailHtml);
      const detailVehicles = extractJsonLdVehicles(detailHtml);
      const detailVehicle = detailVehicles[0];
      if (detailVehicle) {
        mileageKm = extractMileageKm(detailVehicle);
        askingPriceEur = extractPriceEur(detailVehicle);
      }
    }
  }

  return {
    found: true,
    listingUrl,
    title: null,
    descriptionText,
    source: "listing_autotrack",
    mileageKm,
    askingPriceEur,
  };
}

function listingToSpecs(listing: ListingSearchResult): EnrichedSpecMap {
  const combined = [listing.title, listing.descriptionText]
    .filter(Boolean)
    .join(" ");
  return extractEquipmentFromText(combined, listing.source, listing.listingUrl);
}

/**
 * Search Gaspedaal and Autotrack in parallel, then apply cross-source consensus:
 * - A spec found by BOTH sources → listing_claim (corroborated)
 * - A spec found by only ONE source → listing_claim_single (weaker, shown as "Mogelijk onjuist")
 *
 * This prevents noise on one listing page (menu items, sidebars) from asserting a
 * feature as confirmed when the other independent source doesn't mention it.
 */
export async function searchTextListings(
  licensePlate: string,
): Promise<ListingEnrichmentResult> {
  const [gaspedaal, autotrack] = await Promise.all([
    searchGaspedaal(licensePlate).catch(() => null),
    searchAutotrack(licensePlate).catch(() => null),
  ]);

  const gaspedaalSpecs = gaspedaal?.found ? listingToSpecs(gaspedaal) : new Map() as EnrichedSpecMap;
  const autotrackSpecs = autotrack?.found ? listingToSpecs(autotrack) : new Map() as EnrichedSpecMap;

  const allKeys = new Set([...gaspedaalSpecs.keys(), ...autotrackSpecs.keys()]);
  const specs: EnrichedSpecMap = new Map();

  for (const key of allKeys) {
    const gVal = gaspedaalSpecs.get(key);
    const aVal = autotrackSpecs.get(key);

    if (gVal && aVal) {
      // Both sources agree — corroborated, full listing_claim confidence.
      specs.set(key, { ...gVal, verification: "listing_claim" });
    } else {
      // Single source only — lower confidence.
      specs.set(key, { ...(gVal ?? aVal)!, verification: "listing_claim_single" });
    }
  }

  const mileageKm = gaspedaal?.mileageKm ?? autotrack?.mileageKm ?? null;
  const askingPriceEur = gaspedaal?.askingPriceEur ?? autotrack?.askingPriceEur ?? null;

  return { specs, mileageKm, askingPriceEur };
}
