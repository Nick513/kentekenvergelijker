export const THEME_STORAGE_KEY = "kv-theme";

const THEME_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export type Theme = "light" | "dark";

export function isTheme(value: string | undefined | null): value is Theme {
  return value === "light" || value === "dark";
}

export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

export function persistTheme(theme: Theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // localStorage may be unavailable in private browsing.
  }

  document.cookie = `${THEME_STORAGE_KEY}=${theme};path=/;max-age=${THEME_COOKIE_MAX_AGE_SECONDS};SameSite=Lax`;
}

export function resolveTheme(): Theme {
  if (typeof window === "undefined") {
    return "light";
  }

  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark") {
      return stored;
    }
  } catch {
    // localStorage may be unavailable in private browsing.
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export const themeInitScript = `(function(){try{var k="${THEME_STORAGE_KEY}";var s=localStorage.getItem(k);var d=window.matchMedia("(prefers-color-scheme: dark)").matches;var t=s==="light"||s==="dark"?s:(d?"dark":"light");document.documentElement.classList.toggle("dark",t==="dark");document.cookie=k+"="+t+";path=/;max-age=${THEME_COOKIE_MAX_AGE_SECONDS};SameSite=Lax"}catch(e){}})();`;
