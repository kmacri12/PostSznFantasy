import { createLogger } from "./logger";

const log = createLogger("push");

/** Registers the push service worker. The shell calls it once on startup (see #266). */
export const registerServiceWorker = async (): Promise<void> => {
  if (!("serviceWorker" in navigator)) return;
  try {
    await navigator.serviceWorker.register("/sw.js");
  } catch (error) {
    log.warn("Service worker registration failed", error);
  }
};

/** The iPhone or iPad browser, where push works only from the installed Home Screen app. */
export const isIosDevice = (): boolean =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

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
