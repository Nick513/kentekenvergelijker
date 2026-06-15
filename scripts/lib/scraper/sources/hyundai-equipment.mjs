// Parse cumulative trim equipment from the Hyundai NL price list PDF.
// Each trim inherits equipment from lower tiers (i-Motion -> Comfort -> etc.).

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { slugify, toDisplayName } from "../catalog-key.mjs";
import { buildSpecValue } from "../field-map.mjs";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const EQUIPMENT_SOURCE_TAG = "scraped_hyundai";

/** Cumulative trim order (lowest to highest). */
const TRIM_TIERS = [
  "i-Motion",
  "Comfort",
  "Comfort Smart",
  "Premium",
  "Premium Sky",
];

const SECTION_MARKERS = [
  { trim: "i-Motion", pattern: /De i-Motion is standaard/i },
  { trim: "Comfort Smart", pattern: /De Comfort Smart is t\.o\.v\. de Comfort extra/i },
  { trim: "Comfort", pattern: /De Comfort is t\.o\.v\. de i-Motion extra/i },
  { trim: "Premium", pattern: /De Premium is t\.o\.v\. de Comfort Smart extra/i },
  { trim: "Premium Sky", pattern: /Extra op de Premium Sky/i },
];

function normalizeBullet(text) {
  return text
    .replace(/^•\s*/, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function isBulletLine(line) {
  return line.startsWith("•") || line.startsWith("- ");
}

function isNoiseLine(line) {
  if (line.length === 0) return true;
  if (/^www\.|^http|hyundai\.com|scan de qr|^\*|werking afhankelijk/i.test(line)) {
    return true;
  }
  if (/^(Exterieur|Interieur|Multimedia|Veiligheid|Stel samen|Highlights)/i.test(line)) {
    return true;
  }
  return false;
}

/**
 * Split PDF lines into per-tier bullet lists using known section markers.
 */
export function extractTrimBulletSections(lines) {
  const sections = new Map(TRIM_TIERS.map((trim) => [trim, []]));
  let currentTrim = "i-Motion";
  let inIMotionSection = false;

  for (const line of lines) {
    const marker = SECTION_MARKERS.find((entry) => entry.pattern.test(line));
    if (marker) {
      currentTrim = marker.trim;
      if (marker.trim === "i-Motion") inIMotionSection = true;
      continue;
    }

    if (line.match(/^i20\s*-?\s*Prijslijst/i)) break;
    if (line.match(/^Afmetingen \(mm\)/)) break;

    if (!inIMotionSection && currentTrim === "i-Motion") {
      if (line.match(/De i-Motion is standaard/i)) inIMotionSection = true;
      continue;
    }

    if (isNoiseLine(line)) continue;

    if (isBulletLine(line)) {
      const bullet = normalizeBullet(line);
      if (bullet.length > 2) {
        sections.get(currentTrim)?.push(bullet);
      }
      continue;
    }

    // Multi-line bullets: append continuation to last bullet of current trim.
    const list = sections.get(currentTrim);
    if (list && list.length > 0 && line.length > 0 && !/^[A-Z][a-z]+ Smart$/.test(line)) {
      list[list.length - 1] = `${list[list.length - 1]} ${normalizeBullet(line)}`;
    }
  }

  // i-Motion also includes the shared Veiligheid block before Comfort Smart section.
  // Collect early bullets between i-Motion intro and first tier marker.
  const iMotionStart = lines.findIndex((l) => /De i-Motion is standaard/i.test(l));
  const comfortSmartStart = lines.findIndex((l) =>
    /De Comfort Smart is t\.o\.v\. de Comfort extra/i.test(l),
  );
  if (iMotionStart >= 0 && comfortSmartStart > iMotionStart) {
    const baseBullets = [];
    for (let i = iMotionStart + 1; i < comfortSmartStart; i += 1) {
      const line = lines[i];
      if (isNoiseLine(line)) continue;
      if (isBulletLine(line)) {
        baseBullets.push(normalizeBullet(line));
      } else if (baseBullets.length > 0 && line.length > 0) {
        baseBullets[baseBullets.length - 1] = `${baseBullets[baseBullets.length - 1]} ${normalizeBullet(line)}`;
      }
    }
    sections.set("i-Motion", baseBullets);
  }

  return sections;
}

async function loadEquipmentKeywords() {
  const file = path.join(moduleDir, "..", "mappings", "hyundai-equipment.json");
  const parsed = JSON.parse(await readFile(file, "utf8"));
  return (parsed.keywords ?? []).sort(
    (a, b) =>
      Math.max(...b.match.map((m) => m.length)) -
      Math.max(...a.match.map((m) => m.length)),
  );
}

function bulletsToSpecKeys(bullets, keywords) {
  const matched = new Set();
  const textValues = new Map();

  for (const bullet of bullets) {
    for (const entry of keywords) {
      if (matched.has(entry.specKey)) continue;
      const hit = entry.match.some((phrase) => bullet.includes(phrase.toLowerCase()));
      if (hit) {
        matched.add(entry.specKey);
        textValues.set(entry.specKey, bullet);
      }
    }
  }

  return { matched, textValues };
}

function buildCumulativeEquipment(sections) {
  const cumulative = new Map();
  let inherited = [];

  for (const trim of TRIM_TIERS) {
    inherited = [...inherited, ...(sections.get(trim) ?? [])];
    cumulative.set(trim, [...new Set(inherited)]);
  }

  return cumulative;
}

function trimMatches(configTrim, tierTrim) {
  return slugify(configTrim) === slugify(tierTrim);
}

/**
 * Map cumulative PDF equipment onto scraped configurations by trim name.
 *
 * @param {Array<object>} configurations
 * @param {string[]} lines PDF lines
 * @param {Map} specCatalog
 */
export async function applyHyundaiEquipment(configurations, lines, specCatalog) {
  const sections = extractTrimBulletSections(lines);
  const cumulative = buildCumulativeEquipment(sections);
  const keywords = await loadEquipmentKeywords();

  for (const config of configurations) {
    let bullets = null;
    for (const tier of [...TRIM_TIERS].reverse()) {
      if (trimMatches(config.trimName, tier)) {
        bullets = cumulative.get(tier) ?? [];
        break;
      }
    }
    if (!bullets || bullets.length === 0) continue;

    const { matched, textValues } = bulletsToSpecKeys(bullets, keywords);
    const existingKeys = new Set(config.specs.map((s) => s.spec_key));

    for (const specKey of matched) {
      if (existingKeys.has(specKey)) continue;
      const meta = specCatalog.get(specKey);
      if (!meta) continue;

      const raw =
        meta.displayType === "boolean" ? "ja" : (textValues.get(specKey) ?? "Standaard");
      const built = buildSpecValue(specKey, raw, meta);
      if (built) {
        config.specs.push({ ...built, source: EQUIPMENT_SOURCE_TAG });
        existingKeys.add(specKey);
      }
    }

    // Always store trim package label from brochure tier.
    if (!existingKeys.has("trim_package")) {
      const meta = specCatalog.get("trim_package");
      if (meta) {
        const built = buildSpecValue("trim_package", toDisplayName(config.trimName), meta);
        if (built) config.specs.push({ ...built, source: EQUIPMENT_SOURCE_TAG });
      }
    }
  }

  return configurations;
}
