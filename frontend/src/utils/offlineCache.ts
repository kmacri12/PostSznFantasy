import { createLogger } from "./logger";

const log = createLogger("offline-cache");

/** Keep in step with `DATA_CACHE` in public/sw.js. */
export const DATA_CACHE = "ps-data-v1";

/**
 * Forgets the last-seen league data the service worker keeps for offline use. Run whenever a
 * session ends, so the next person to use this device never sees the previous member's leagues.
 */
export const clearOfflineData = async (): Promise<void> => {
  if (typeof caches === "undefined") return;
  try {
    await caches.delete(DATA_CACHE);
  } catch (error) {
    log.warn("Could not clear the offline data cache", error);
  }
};
