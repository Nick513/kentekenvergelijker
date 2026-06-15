// Catalog key builder and slug helpers.
// catalog_key = {brand}|{model}|{generation}|{trim}|{engine}
// Each segment is slugified; the pipe separates segments and never appears inside one.

const SEGMENT_SEPARATOR = "|";

/**
 * Lowercase, strip diacritics, collapse any run of non-alphanumeric characters
 * into a single hyphen, and trim leading/trailing hyphens.
 *
 * Examples:
 *   "Hyundai"            -> "hyundai"
 *   "Santa Fe"           -> "santa-fe"
 *   "Premium Sky"        -> "premium-sky"
 *   "1.0 T-GDI MHEV"     -> "1-0-t-gdi-mhev"
 *   "1.2 MPI"            -> "1-2-mpi"
 */
export function slugify(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Title-case a trim or engine name for display in `trim_name`.
 * Keeps short tokens uppercase where they are clearly acronyms is out of scope;
 * sources should pass the preferred display form when they have it.
 */
export function toDisplayName(value) {
  if (!value) {
    return "";
  }

  return String(value)
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((word) =>
      word.length === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(" ");
}

/**
 * Build a catalog_key from its five identity segments.
 * Throws if any required segment slugifies to an empty string, because an
 * incomplete key would collide with other configurations.
 *
 * @param {{ brand: string, model: string, generation: string, trim: string, engine: string }} parts
 * @returns {string}
 */
export function buildCatalogKey({ brand, model, generation, trim, engine }) {
  const segments = {
    brand: slugify(brand),
    model: slugify(model),
    generation: slugify(generation),
    trim: slugify(trim),
    engine: slugify(engine),
  };

  const missing = Object.entries(segments)
    .filter(([, slug]) => slug.length === 0)
    .map(([name]) => name);

  if (missing.length > 0) {
    throw new Error(
      `Cannot build catalog_key, empty segment(s): ${missing.join(", ")}`,
    );
  }

  return [
    segments.brand,
    segments.model,
    segments.generation,
    segments.trim,
    segments.engine,
  ].join(SEGMENT_SEPARATOR);
}

/**
 * Derive an engine slug from a displacement (cc) and a fuel description when a
 * marketing engine name is not available (Plan B sources). Honest fallback that
 * does not invent a marketing badge such as "T-GDI".
 *
 * Examples:
 *   (998, "Benzine")  -> "1-0-benzine"
 *   (1197, "Benzine") -> "1-2-benzine"
 *   (998, "Hybride")  -> "1-0-hybride"
 */
export function engineSlugFromDisplacement(displacementCc, fuelDescription) {
  const liters = Number.isFinite(displacementCc)
    ? (Math.round(displacementCc / 100) / 10).toFixed(1)
    : null;
  const litersSlug = liters ? slugify(liters) : null;
  const fuelSlug = slugify(fuelDescription);

  const parts = [litersSlug, fuelSlug].filter(Boolean);
  return parts.length > 0 ? parts.join("-") : "";
}
