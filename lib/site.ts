export const SITE_URL = "https://kentekenvergelijker.nl";
export const SITE_NAME = "Kentekenvergelijker";

export const SITE_TAGLINE = "Vergelijk tot in de uitrusting";

export const SITE_TITLE =
  "Kenteken vergelijken - Auto's vergelijken op kenteken";

export const SITE_DESCRIPTION =
  "Vergelijk 2 tot 8 Nederlandse kentekens naast elkaar. Zie merk, model, uitvoering en uitrusting van de exacte auto's: van stoelverwarming tot rijassistentie. Gratis en zonder account.";

export const SITE_KEYWORDS = [
  "kenteken vergelijken",
  "kentekens vergelijken",
  "auto vergelijken op kenteken",
  "auto vergelijken",
  "auto uitrusting vergelijken",
  "occasion vergelijken",
  "auto opties vergelijken",
  "kenteken opzoeken",
  "Nederlandse kentekens",
  "auto specificaties vergelijken",
  "tweedehands auto vergelijken",
];

export function absoluteUrl(path = ""): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
