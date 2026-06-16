/**
 * Debug script: fetch listing pages for a plate and dump JSON-LD vehicle nodes.
 * Shows exactly what mileageFromOdometer and offers.price look like (or don't).
 *
 * Usage: node scripts/debug-listing-market.mjs <PLATE>
 * Example: node scripts/debug-listing-market.mjs HGL33B
 */

import * as cheerio from "cheerio";

const plate = process.argv[2]?.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
if (!plate) {
  console.error("Usage: node scripts/debug-listing-market.mjs <PLATE>");
  process.exit(1);
}

const formatted = plate.slice(0, 2) + "-" + plate.slice(2, 5) + "-" + plate.slice(5);

async function fetchHtml(url, referer) {
  const headers = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "nl-NL,nl;q=0.9",
    "Cache-Control": "max-age=0",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": referer ? "cross-site" : "none",
    ...(referer ? { Referer: referer } : {}),
  };
  try {
    const res = await fetch(url, { headers });
    if (!res.ok) {
      console.log(`  -> HTTP ${res.status} for ${url}`);
      return null;
    }
    return await res.text();
  } catch (e) {
    console.log(`  -> fetch error: ${e.message}`);
    return null;
  }
}

function hasType(node, type) {
  const t = node?.["@type"];
  return Array.isArray(t) ? t.includes(type) : t === type;
}

function extractJsonLdVehicles(html) {
  const $ = cheerio.load(html);
  const vehicles = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).contents().text();
    if (!raw) return;
    let data;
    try { data = JSON.parse(raw); } catch { return; }
    const nodes = Array.isArray(data) ? data : [data];
    for (const node of nodes) {
      if (!node || typeof node !== "object") continue;
      if (hasType(node, "Car")) vehicles.push(node);
      if (hasType(node, "ItemList") && Array.isArray(node.itemListElement)) {
        for (const entry of node.itemListElement) {
          if (hasType(entry?.item, "Car")) vehicles.push(entry.item);
          if (hasType(entry, "Car")) vehicles.push(entry);
        }
      }
    }
  });
  return vehicles;
}

function findListingLink(html, variants, base) {
  const $ = cheerio.load(html);
  let found = null;
  const haystack = (text) => text.replace(/[-\s]/g, "").toLowerCase();
  const hasPlate = (text) => variants.some(v => haystack(text).includes(haystack(v)));

  $("a[href]").each((_, el) => {
    if (found) return;
    const href = $(el).attr("href") ?? "";
    const text = $(el).text();
    if (!hasPlate(`${href} ${text}`)) return;
    if (href.includes("/auto/") || href.includes("/occasion") || href.includes("/voertuig/") || href.includes("/listing/")) {
      found = href.startsWith("http") ? href : `${base}${href}`;
    }
  });
  return found;
}

function showMarketFields(label, vehicle) {
  console.log(`\n  [${label}] JSON-LD Car node keys: ${Object.keys(vehicle).join(", ")}`);
  console.log(`  mileageFromOdometer: ${JSON.stringify(vehicle.mileageFromOdometer ?? "NOT FOUND")}`);
  console.log(`  offers:              ${JSON.stringify(vehicle.offers ?? "NOT FOUND")}`);
  console.log(`  price:               ${JSON.stringify(vehicle.price ?? "NOT FOUND")}`);
}

const variants = [plate, formatted, plate.toLowerCase(), formatted.toLowerCase()];

// ── Gaspedaal ──────────────────────────────────────────────────────────────
console.log("\n=== GASPEDAAL ===");
const gaspedaalSearchUrl = `https://www.gaspedaal.nl/zoeken?kenteken=${plate}`;
console.log(`Search: ${gaspedaalSearchUrl}`);
const gaspedaalHtml = await fetchHtml(gaspedaalSearchUrl, "https://www.google.nl/");
if (gaspedaalHtml) {
  const vehicles = extractJsonLdVehicles(gaspedaalHtml);
  console.log(`  JSON-LD Car nodes on search page: ${vehicles.length}`);
  vehicles.forEach((v, i) => showMarketFields(`search node ${i}`, v));

  const listingUrl = findListingLink(gaspedaalHtml, variants, "https://www.gaspedaal.nl");
  console.log(`  Listing URL: ${listingUrl ?? "NOT FOUND"}`);
  if (listingUrl) {
    const detailHtml = await fetchHtml(listingUrl, gaspedaalSearchUrl);
    if (detailHtml) {
      const dv = extractJsonLdVehicles(detailHtml);
      console.log(`  JSON-LD Car nodes on detail page: ${dv.length}`);
      dv.forEach((v, i) => showMarketFields(`detail node ${i}`, v));
    }
  }
} else {
  console.log("  No HTML returned");
}

// ── Autotrack ──────────────────────────────────────────────────────────────
console.log("\n=== AUTOTRACK ===");
const autotrackUrl = `https://www.autotrack.nl/aanbod?kenteken=${plate}`;
console.log(`Search: ${autotrackUrl}`);
const autotrackHtml = await fetchHtml(autotrackUrl, "https://www.google.nl/");
if (autotrackHtml) {
  const vehicles = extractJsonLdVehicles(autotrackHtml);
  console.log(`  JSON-LD Car nodes on search page: ${vehicles.length}`);
  vehicles.forEach((v, i) => showMarketFields(`search node ${i}`, v));

  const fixedHtml = autotrackHtml.replaceAll("autotrack.nl", "www.autotrack.nl");
  const listingUrl = findListingLink(fixedHtml, variants, "");
  console.log(`  Listing URL: ${listingUrl ?? "NOT FOUND"}`);
  if (listingUrl) {
    const detailHtml = await fetchHtml(listingUrl, autotrackUrl);
    if (detailHtml) {
      const dv = extractJsonLdVehicles(detailHtml);
      console.log(`  JSON-LD Car nodes on detail page: ${dv.length}`);
      dv.forEach((v, i) => showMarketFields(`detail node ${i}`, v));
    }
  }
} else {
  console.log("  No HTML returned");
}

// ── AutoScout24 ────────────────────────────────────────────────────────────
console.log("\n=== AUTOSCOUT24 ===");
const as24Url = `https://www.autoscout24.nl/lst?search=${plate}`;
console.log(`Search: ${as24Url}`);
const as24Html = await fetchHtml(as24Url, "https://www.google.nl/");
if (as24Html) {
  const vehicles = extractJsonLdVehicles(as24Html);
  console.log(`  JSON-LD Car nodes on search page: ${vehicles.length}`);
  vehicles.forEach((v, i) => showMarketFields(`search node ${i}`, v));

  const listingUrl = findListingLink(as24Html, variants, "https://www.autoscout24.nl");
  console.log(`  Listing URL: ${listingUrl ?? "NOT FOUND"}`);
  if (listingUrl) {
    const detailHtml = await fetchHtml(listingUrl, as24Url);
    if (detailHtml) {
      const dv = extractJsonLdVehicles(detailHtml);
      console.log(`  JSON-LD Car nodes on detail page: ${dv.length}`);
      dv.forEach((v, i) => showMarketFields(`detail node ${i}`, v));
    }
  }
} else {
  console.log("  No HTML returned");
}

console.log("\nDone.");
