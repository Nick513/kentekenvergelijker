const FETCH_TIMEOUT_MS = 12_000;

type UaProfile = {
  userAgent: string;
  secChUa: string;
  secChUaPlatform: string;
};

// A small pool of realistic, current Chrome profiles. One is picked randomly per
// request so consecutive fetches don't share an identical fingerprint.
const UA_PROFILES: UaProfile[] = [
  {
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    secChUa: '"Google Chrome";v="125", "Chromium";v="125", "Not.A/Brand";v="24"',
    secChUaPlatform: '"Windows"',
  },
  {
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    secChUa: '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
    secChUaPlatform: '"Windows"',
  },
  {
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    secChUa: '"Google Chrome";v="125", "Chromium";v="125", "Not.A/Brand";v="24"',
    secChUaPlatform: '"macOS"',
  },
  {
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    secChUa: '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
    secChUaPlatform: '"macOS"',
  },
  {
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    secChUa: '"Google Chrome";v="125", "Chromium";v="125", "Not.A/Brand";v="24"',
    secChUaPlatform: '"Linux"',
  },
];

function pickProfile(): UaProfile {
  return UA_PROFILES[Math.floor(Math.random() * UA_PROFILES.length)];
}

/**
 * Determine Sec-Fetch-Site relative to an optional referer URL.
 * Approximates the browser's own logic without a full public-suffix-list.
 */
function secFetchSite(targetUrl: string, referer?: string): string {
  if (!referer) return "none";
  try {
    const t = new URL(targetUrl);
    const r = new URL(referer);
    if (t.origin === r.origin) return "same-origin";
    const tHost = t.hostname.split(".").slice(-2).join(".");
    const rHost = r.hostname.split(".").slice(-2).join(".");
    return tHost === rHost ? "same-site" : "cross-site";
  } catch {
    return "none";
  }
}

export type FetchOptions = {
  /** URL that logically preceded this request (search page → detail page, etc.) */
  referer?: string;
};

export async function fetchHtml(
  url: string,
  options: FetchOptions = {},
): Promise<string | null> {
  const profile = pickProfile();
  const site = secFetchSite(url, options.referer);

  const headers: Record<string, string> = {
    "User-Agent": profile.userAgent,
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "Accept-Language": "nl-NL,nl;q=0.9,en-US;q=0.8,en;q=0.7",
    "Accept-Encoding": "gzip, deflate, br",
    "Cache-Control": "max-age=0",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Ch-Ua": profile.secChUa,
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": profile.secChUaPlatform,
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": site,
    "Sec-Fetch-User": "?1",
  };

  if (options.referer) {
    headers["Referer"] = options.referer;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers,
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
