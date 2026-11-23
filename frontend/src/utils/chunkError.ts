import { createLogger } from "./logger";

const logger = createLogger("chunkError");

const RELOAD_KEY = "ps-chunk-reload";
// A second chunk failure this soon after a reload means a reload did not help.
const RELOAD_WINDOW_MS = 60_000;

const CHUNK_MESSAGES = [
  "Failed to fetch dynamically imported module", // Chromium
  "error loading dynamically imported module", // Firefox
  "Importing a module script failed", // Safari
  "Unable to preload CSS",
];

/** A lazy route file that could not be loaded, usually because a deploy replaced it. */
export const isChunkLoadError = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  return (
    error.name === "ChunkLoadError" ||
    CHUNK_MESSAGES.some((message) => error.message.includes(message))
  );
};

/** The service worker's app-shell caches; keep the prefix in step with `SHELL_CACHE` in public/sw.js. */
const SHELL_CACHE_PREFIX = "ps-shell";

/**
 * Drops the cached app shell and page files before the member's refresh, so a file the service
 * worker kept wrongly can never answer the reload too. The next load fetches everything fresh.
 */
export const clearShellCaches = async (): Promise<void> => {
  if (typeof caches === "undefined") return;
  try {
    const names = await caches.keys();
    await Promise.all(
      names
        .filter((name) => name.startsWith(SHELL_CACHE_PREFIX))
        .map((name) => caches.delete(name)),
    );
  } catch (error) {
    logger.warn("Could not clear the app shell cache", error);
  }
};

/** Remember the member's own reload tap so a repeat failure is not met with the same offer. */
export const markReloadAttempt = (now: number = Date.now()): void => {
  try {
    sessionStorage.setItem(RELOAD_KEY, String(now));
  } catch {
    // Storage can be blocked; the screen then simply offers Refresh again.
  }
};

export const reloadedRecently = (now: number = Date.now()): boolean => {
  try {
    const at = Number(sessionStorage.getItem(RELOAD_KEY));
    return Number.isFinite(at) && at > 0 && now - at < RELOAD_WINDOW_MS;
  } catch {
    return false;
  }
};

/** Vite fires this when a preload fails; the error still reaches the route's error screen. */
export const watchPreloadErrors = (): void => {
  window.addEventListener("vite:preloadError", () => {
    logger.warn("A page file failed to load; likely a new deploy");
  });
};
