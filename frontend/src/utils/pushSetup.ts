import { api } from "../api/client";
import { E2E_BUILD } from "./e2e";
import { createLogger } from "./logger";

const log = createLogger("push");

/**
 * Registers the service worker (push, #266, and the offline cache, #400). The shell calls it
 * once on startup. The e2e build turns the caching off with `?nocache`, so `page.route` mocks
 * (which a service worker's own fetches would bypass) keep working.
 */
export const registerServiceWorker = async (): Promise<void> => {
  if (!("serviceWorker" in navigator)) return;
  try {
    await navigator.serviceWorker.register(E2E_BUILD ? "/sw.js?nocache=1" : "/sw.js");
  } catch (error) {
    log.warn("Service worker registration failed", error);
  }
};

/** The iPhone or iPad browser, where push works only from the installed Home Screen app. */
export const isIosDevice = (): boolean =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

export const isAndroidDevice = (): boolean => /Android/i.test(navigator.userAgent);

/** Which set of instructions fits this device: each platform allows notifications differently. */
export type PushDevice = "android" | "ios" | "desktop";

export const pushDevice = (): PushDevice =>
  isIosDevice() ? "ios" : isAndroidDevice() ? "android" : "desktop";

export const isStandalone = (): boolean =>
  window.matchMedia?.("(display-mode: standalone)").matches === true ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

export const pushApisAvailable = (): boolean =>
  "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

/** `pushManager.subscribe` wants the VAPID key as bytes, the API serves it base64url. */
export const urlBase64ToUint8Array = (value: string): Uint8Array<ArrayBuffer> => {
  const padded = value + "=".repeat((4 - (value.length % 4)) % 4);
  const raw = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
};

const FORGET_TIMEOUT_MS = 3000;

/**
 * Removes this browser's push subscription from the server and the browser, so a signed-out
 * device stops getting the account's notifications. Best effort: it never throws and gives up
 * after a few seconds so sign-out is never held up.
 */
export const forgetThisDevice = async (): Promise<void> => {
  if (!pushApisAvailable()) return;
  const forget = async () => {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;
    await api.delete("/api/push/subscriptions", { data: { endpoint: subscription.endpoint } });
    await subscription.unsubscribe();
  };
  try {
    await Promise.race([
      forget(),
      new Promise<void>((resolve) => setTimeout(resolve, FORGET_TIMEOUT_MS)),
    ]);
  } catch (error) {
    log.warn("Could not remove this device's push subscription", error);
  }
};

/** Re-posts an existing subscription so the server's `last_seen` stays fresh (and the row
 * follows whoever is signed in). Best effort. */
export const refreshPushSubscription = async (): Promise<void> => {
  if (!pushApisAvailable() || Notification.permission !== "granted") return;
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) await api.post("/api/push/subscriptions", subscription.toJSON());
  } catch (error) {
    log.warn("Could not refresh the push subscription", error);
  }
};
