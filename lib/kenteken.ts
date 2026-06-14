type CharType = "L" | "D";

/** Known 6-character Dutch kenteken sidecode patterns (letters vs digits). */
const KENTEKEN_FORMATS: { pattern: CharType[]; groups: number[] }[] = [
  { pattern: ["L", "L", "D", "D", "D", "L"], groups: [2, 3, 1] }, // AB-123-C
  { pattern: ["L", "D", "D", "D", "L", "L"], groups: [1, 3, 2] }, // X-999-XX
  { pattern: ["L", "L", "D", "D", "L", "L"], groups: [2, 2, 2] }, // AB-12-CD
  { pattern: ["L", "L", "L", "D", "D", "L"], groups: [3, 2, 1] }, // ABC-12-D
  { pattern: ["L", "D", "D", "L", "L", "L"], groups: [1, 2, 3] }, // A-12-BCD
  { pattern: ["D", "D", "D", "D", "D", "D"], groups: [2, 2, 2] },
  { pattern: ["L", "L", "L", "L", "L", "L"], groups: [2, 2, 2] },
];

const DEFAULT_GROUPS = [2, 2, 2];

export const MIN_COMPARISON_PLATES = 2;
export const MAX_COMPARISON_PLATES = 4;

export function normalizeKenteken(input: string): string {
  return input.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 6);
}

function getCharTypes(clean: string): CharType[] {
  return [...clean].map((char) => (/\d/.test(char) ? "D" : "L"));
}

function matchesPrefix(types: CharType[], pattern: CharType[]): boolean {
  if (types.length > pattern.length) return false;

  for (let index = 0; index < types.length; index++) {
    if (types[index] !== pattern[index]) return false;
  }

  return true;
}

function findMatchingFormats(types: CharType[]) {
  return KENTEKEN_FORMATS.filter((format) => matchesPrefix(types, format.pattern));
}

function findGroups(types: CharType[]): number[] {
  if (types.length === 0) return DEFAULT_GROUPS;

  const matches = findMatchingFormats(types);
  if (matches.length === 0) return DEFAULT_GROUPS;

  const firstGroups = matches[0].groups;
  const allAgree = matches.every((match) =>
    match.groups.every((size, index) => size === firstGroups[index]),
  );

  if (allAgree) return firstGroups;

  // Disambiguate partial input (e.g. "AB" matches both 2-2-2 and 2-3-1).
  if (types.length >= 2) {
    if (types[0] === "L" && types[1] === "D") {
      const format = matches.find((match) => match.groups[0] === 1);
      if (format) return format.groups;
    }

    if (types[0] === "L" && types[1] === "L" && types[2] === "L") {
      const format = matches.find((match) => match.groups[0] === 3);
      if (format) return format.groups;
    }

    if (types[0] === "L" && types[1] === "L") {
      const format = matches.find((match) => match.groups[0] === 2);
      if (format) return format.groups;
    }
  }

  return firstGroups;
}

function applyGroups(clean: string, groups: number[]): string {
  const parts: string[] = [];
  let index = 0;

  for (const size of groups) {
    if (index >= clean.length) break;
    parts.push(clean.slice(index, index + size));
    index += size;
  }

  return parts.join("-");
}

export function formatKenteken(input: string): string {
  const clean = normalizeKenteken(input);
  if (!clean) return "";

  return applyGroups(clean, findGroups(getCharTypes(clean)));
}

export function isValidKenteken(input: string): boolean {
  return normalizeKenteken(input).length === 6;
}

export function toKentekenSlug(kenteken: string): string {
  return normalizeKenteken(kenteken).toLowerCase();
}

export function slugToKenteken(slug: string): string {
  return formatKenteken(slug);
}

export function buildComparisonPath(kentekens: string[]): string {
  return `/${kentekens.map(toKentekenSlug).join("/")}`;
}

export function parseComparisonSlugs(
  slugs: string[],
): { kentekens: string[]; slugs: string[] } | null {
  if (
    slugs.length < MIN_COMPARISON_PLATES ||
    slugs.length > MAX_COMPARISON_PLATES
  ) {
    return null;
  }

  const kentekens = slugs.map(slugToKenteken);

  if (kentekens.some((kenteken) => !isValidKenteken(kenteken))) {
    return null;
  }

  const unique = new Set(kentekens.map(normalizeKenteken));
  if (unique.size !== kentekens.length) {
    return null;
  }

  const normalizedSlugs = kentekens.map(toKentekenSlug);

  return { kentekens, slugs: normalizedSlugs };
}
