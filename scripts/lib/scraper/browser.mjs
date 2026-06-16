// Puppeteer + stealth wrapper. Used ONLY for manufacturer sites (brochure
// download pages, configurators) to reduce bot detection. Plan B listing sites
// use plain fetch in http.mjs.

import puppeteerExtra from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { EVENT_CODES } from "./scrape-report.mjs";

let pluginRegistered = false;

function getPuppeteer() {
  if (!pluginRegistered) {
    puppeteerExtra.use(StealthPlugin());
    pluginRegistered = true;
  }
  return puppeteerExtra;
}

/**
 * Launch a stealth browser, run `fn(browser)`, and always close the browser.
 *
 * @template T
 * @param {(browser: import("puppeteer").Browser) => Promise<T>} fn
 * @returns {Promise<T>}
 */
export async function withBrowser(fn) {
  const puppeteer = getPuppeteer();
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    return await fn(browser);
  } finally {
    await browser.close();
  }
}

/**
 * Navigate to a URL with a stealth browser and return the rendered HTML.
 *
 * @param {string} url
 * @param {{ waitUntil?: import("puppeteer").PuppeteerLifeCycleEvent, timeoutMs?: number, logger?: { recordFetchError?: Function, info?: Function }, source?: string }} [options]
 * @returns {Promise<string>}
 */
export async function fetchRenderedHtml(url, options = {}) {
  const { waitUntil = "networkidle2", timeoutMs = 45000, logger, source } = options;

  try {
    const html = await withBrowser(async (browser) => {
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 900 });
      await page.goto(url, { waitUntil, timeout: timeoutMs });
      return page.content();
    });
    logger?.info?.(`Browser fetch OK ${url}`, EVENT_CODES.HTTP_FETCH_OK, { url, source });
    return html;
  } catch (error) {
    logger?.recordFetchError?.(error, { url, source });
    throw error;
  }
}
