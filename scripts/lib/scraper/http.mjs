// Polite HTTP fetch helpers for Plan B listing sites (no browser needed).
// Manufacturer sites use browser.mjs (Puppeteer + stealth) instead.

const DEFAULT_USER_AGENT =
  "KentekenvergelijkerCatalogBot/1.0 (+internal catalog enrichment)";
const DEFAULT_DELAY_MS = 1500;
const DEFAULT_JITTER_MS = 500;
const DEFAULT_RETRIES = 3;

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Delay between requests with a small random jitter to avoid lockstep traffic. */
export async function politeDelay(baseMs = DEFAULT_DELAY_MS, jitterMs = DEFAULT_JITTER_MS) {
  const jitter = Math.floor(Math.random() * jitterMs);
  await sleep(baseMs + jitter);
}

/**
 * Fetch a URL as text with retries and exponential backoff on 429/5xx.
 *
 * @param {string} url
 * @param {{ headers?: Record<string, string>, retries?: number }} [options]
 * @returns {Promise<string>}
 */
export async function fetchText(url, options = {}) {
  const { headers = {}, retries = DEFAULT_RETRIES } = options;

  let lastError = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": DEFAULT_USER_AGENT, Accept: "text/html", ...headers },
      });

      if (response.ok) {
        return await response.text();
      }

      if (response.status === 429 || response.status >= 500) {
        lastError = new Error(`HTTP ${response.status} for ${url}`);
      } else {
        throw new Error(`HTTP ${response.status} for ${url}`);
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }

    if (attempt < retries) {
      const backoff = DEFAULT_DELAY_MS * 2 ** attempt;
      await sleep(backoff);
    }
  }

  throw lastError ?? new Error(`Failed to fetch ${url}`);
}
