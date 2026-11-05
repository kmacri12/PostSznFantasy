import { palettes, type ThemeMode } from "../theme";

/** Also read by the inline script in index.html, which sets the mode before first paint. */
export const THEME_STORAGE_KEY = "postszn-theme";

const MANIFESTS: Record<ThemeMode, string> = {
  dark: "/manifest.webmanifest",
  light: "/manifest-light.webmanifest",
};

export const parseThemeMode = (value: unknown): ThemeMode => (value === "light" ? "light" : "dark");

/** Storage can throw (private windows, blocked site data), so a failure just means "dark". */
export const readStoredThemeMode = (): ThemeMode => {
  try {
    return parseThemeMode(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return "dark";
  }
};

export const storeThemeMode = (mode: ThemeMode): void => {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    // The choice then lasts only until the page closes.
  }
};

/** Flips the CSS variables (via data-theme) and the browser and installed-app chrome. */
export const applyThemeMode = (mode: ThemeMode): void => {
  document.documentElement.dataset.theme = mode;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", palettes[mode].bg);
  document.querySelector('link[rel="manifest"]')?.setAttribute("href", MANIFESTS[mode]);
};
