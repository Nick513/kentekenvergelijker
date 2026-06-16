import * as cheerio from "cheerio";
import { fetchHtml } from "@/lib/enrichment/fetch-html";
import { extractEquipmentFromText } from "@/lib/enrichment/keywords";
import type { EnrichedSpecMap, ListingSearchResult } from "@/lib/enrichment/types";
import { formatKenteken, normalizeKenteken } from "@/lib/kenteken";

const GASPEDAAL_BASE = "https://www.gaspedaal.nl";

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

      if (record["@type"] === "Car") {
        vehicles.push(record);
      }

      if (record["@type"] === "ItemList" && Array.isArray(record.itemListElement)) {
        for (const entry of record.itemListElement as Record<string, unknown>[]) {
          const item = entry.item as Record<string, unknown> | undefined;
          if (item?.["@type"] === "Car") {
            vehicles.push(item);
          }
        }
      }
    }
  });

  return vehicles;
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
    const html = await fetchHtml(url);
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

    if (listingUrl) {
      const detailHtml = await fetchHtml(listingUrl);
      if (detailHtml) {
        descriptionText = cheerio.load(detailHtml)("body").text();
        const detailVehicles = extractJsonLdVehicles(detailHtml);
        const detailVehicle = detailVehicles[0];
        if (detailVehicle) {
          title =
            typeof detailVehicle.name === "string" ? detailVehicle.name : title;
          descriptionText = `${descriptionText} ${vehicleToText(detailVehicle)}`;
        }
      }
    } else if (!descriptionText) {
      descriptionText = cheerio.load(html)("body").text();
    }

    return {
      found: true,
      listingUrl,
      title,
      descriptionText,
      source: "listing_gaspedaal",
    };
  }

  return null;
}

async function searchAutotrack(licensePlate: string): Promise<ListingSearchResult | null> {
  const normalized = normalizeKenteken(licensePlate);
  const variants = plateVariants(licensePlate);
  const url = `https://www.autotrack.nl/aanbod?kenteken=${normalized}`;
  const html = await fetchHtml(url);

  if (!html || !textContainsPlate(html, variants)) {
    return null;
  }

  const listingUrl = findListingUrl(
    html.replaceAll("autotrack.nl", "www.autotrack.nl"),
    variants,
  );
  let descriptionText = cheerio.load(html)("body").text();

  if (listingUrl) {
    const detailHtml = await fetchHtml(listingUrl);
    if (detailHtml) {
      descriptionText = cheerio.load(detailHtml)("body").text();
    }
  }

  return {
    found: true,
    listingUrl,
    title: null,
    descriptionText,
    source: "listing_autotrack",
  };
}

function listingToSpecs(listing: ListingSearchResult): EnrichedSpecMap {
  const combined = [listing.title, listing.descriptionText]
    .filter(Boolean)
    .join(" ");
  return extractEquipmentFromText(combined, listing.source, listing.listingUrl);
}

/** Search Gaspedaal and Autotrack in parallel, merge keyword-matched specs from both. */
export async function searchTextListings(
  licensePlate: string,
): Promise<EnrichedSpecMap> {
  const [gaspedaal, autotrack] = await Promise.all([
    searchGaspedaal(licensePlate).catch(() => null),
    searchAutotrack(licensePlate).catch(() => null),
  ]);

  const specs: EnrichedSpecMap = new Map();

  for (const listing of [gaspedaal, autotrack]) {
    if (!listing?.found) continue;
    for (const [key, value] of listingToSpecs(listing)) {
      if (!specs.has(key)) {
        specs.set(key, value);
      }
    }
  }

  return specs;
}
