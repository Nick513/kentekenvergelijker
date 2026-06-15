type CharType = "L" | "D";

/** Known 6-character Dutch kenteken sidecode patterns (letters vs digits). */
const KENTEKEN_FORMATS: { pattern: CharType[]; groups: number[] }[] = [
  { pattern: ["L", "L", "D", "D", "D", "D"], groups: [2, 2, 2] }, // XX-99-99
  { pattern: ["D", "D", "D", "D", "L", "L"], groups: [2, 2, 2] }, // 99-99-XX
  { pattern: ["D", "D", "L", "L", "D", "D"], groups: [2, 2, 2] }, // 99-XX-99
  { pattern: ["L", "L", "D", "D", "L", "L"], groups: [2, 2, 2] }, // XX-99-XX
  { pattern: ["L", "L", "L", "L", "D", "D"], groups: [2, 2, 2] }, // XX-XX-99
  { pattern: ["D", "D", "L", "L", "L", "L"], groups: [2, 2, 2] }, // 99-XX-XX
  { pattern: ["D", "D", "L", "L", "L", "D"], groups: [2, 3, 1] }, // 99-XXX-9
  { pattern: ["D", "L", "L", "L", "D", "D"], groups: [1, 3, 2] }, // 9-XXX-99
  { pattern: ["L", "L", "D", "D", "D", "L"], groups: [2, 3, 1] }, // XX-999-X
  { pattern: ["L", "D", "D", "D", "L", "L"], groups: [1, 3, 2] }, // X-999-XX
  { pattern: ["L", "L", "L", "D", "D", "L"], groups: [3, 2, 1] }, // XXX-99-X
  { pattern: ["L", "D", "D", "L", "L", "L"], groups: [1, 2, 3] }, // X-99-XXX
  { pattern: ["D", "L", "L", "D", "D", "D"], groups: [1, 2, 3] }, // 9-XX-999
  { pattern: ["D", "D", "D", "L", "L", "D"], groups: [3, 2, 1] }, // 999-XX-9
];

const DEFAULT_GROUPS = [2, 2, 2];

/**
 * RDW sidecode patterns (14 series). Mirrors license-plate package sidecodes.
 * @see https://github.com/niels-bosman/license-plate/blob/main/src/data/sidecodes.ts
 */
const SIDECODE_PATTERNS: RegExp[] = [
  /^([A-Z]{2})(\d{2})(\d{2})$/, // 1: XX-99-99
  /^(\d{2})(\d{2})([A-Z]{2})$/, // 2: 99-99-XX
  /^(\d{2})([A-Z]{2})(\d{2})$/, // 3: 99-XX-99
  /^([A-Z]{2})(\d{2})([A-Z]{2})$/, // 4: XX-99-XX
  /^([A-Z]{2})([A-Z]{2})(\d{2})$/, // 5: XX-XX-99
  /^(\d{2})([A-Z]{2})([A-Z]{2})$/, // 6: 99-XX-XX
  /^(\d{2})([A-Z]{3})(\d)$/, // 7: 99-XXX-9
  /^(\d)([A-Z]{3})(\d{2})$/, // 8: 9-XXX-99
  /^([A-Z]{2})(\d{3})([A-Z])$/, // 9: XX-999-X
  /^([A-Z])(\d{3})([A-Z]{2})$/, // 10: X-999-XX
  /^([A-Z]{3})(\d{2})([A-Z])$/, // 11: XXX-99-X
  /^([A-Z])(\d{2})([A-Z]{3})$/, // 12: X-99-XXX
  /^(\d)([A-Z]{2})(\d{3})$/, // 13: 9-XX-999
  /^(\d{3})([A-Z]{2})(\d)$/, // 14: 999-XX-9
];

/** Forbidden letter combinations on Dutch plates. */
const FORBIDDEN_WORDS = [
  "GVD",
  "KKK",
  "KVT",
  "LPF",
  "NSB",
  "PKK",
  "PSV",
  "TBS",
  "SS",
  "SD",
] as const;

export const MIN_COMPARISON_PLATES = 2;
export const MAX_COMPARISON_PLATES = 8;

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

    if (types[0] === "D" && types[1] === "L") {
      if (types.length >= 4 && types[3] === "D") {
        const format = matches.find((match) => match.groups[0] === 1 && match.groups[1] === 2);
        if (format) return format.groups;
      }

      const format = matches.find((match) => match.groups[0] === 1 && match.groups[1] === 3);
      if (format) return format.groups;
    }

    if (types[0] === "D" && types[1] === "D" && types[2] === "L" && types[3] === "L") {
      if (types.length >= 5 && types[4] === "L") {
        const format = matches.find((match) => match.groups[1] === 3);
        if (format) return format.groups;
      }

      if (types.length >= 5 && types[4] === "D") {
        const format = matches.find(
          (match) => match.pattern[4] === "D" && match.pattern[5] === "D",
        );
        if (format) return format.groups;
      }
    }

    if (types[0] === "D" && types[1] === "D" && types[2] === "D") {
      if (types.length >= 4 && types[3] === "L") {
        const format = matches.find((match) => match.groups[0] === 3);
        if (format) return format.groups;
      }
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

function findSidecode(clean: string): number {
  const index = SIDECODE_PATTERNS.findIndex((pattern) => pattern.test(clean));
  return index + 1;
}

function formatBySidecode(clean: string, sidecode: number): string {
  if (sidecode === 0) return "";

  const match = clean.match(SIDECODE_PATTERNS[sidecode - 1]);
  if (!match) return "";

  return match.slice(1).join("-");
}

function hasForbiddenCombination(clean: string, sidecode: number): boolean {
  let forbidden: string[] = [...FORBIDDEN_WORDS];

  if (sidecode >= 7) {
    forbidden = [...forbidden, "PVV", "SGP"];
  }

  if (sidecode >= 8) {
    forbidden = [...forbidden, "VVD"];
  }

  const formatted = formatBySidecode(clean, sidecode);
  return forbidden.some((word) => formatted.includes(word));
}

export function formatKenteken(input: string): string {
  const clean = normalizeKenteken(input);
  if (!clean) return "";

  return applyGroups(clean, findGroups(getCharTypes(clean)));
}

export function isValidKenteken(input: string): boolean {
  const clean = normalizeKenteken(input);
  if (clean.length !== 6) return false;

  const sidecode = findSidecode(clean);
  if (sidecode === 0) return false;

  return !hasForbiddenCombination(clean, sidecode);
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
