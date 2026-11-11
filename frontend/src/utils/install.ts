import { isAndroidDevice, isIosDevice, isStandalone } from "./pushSetup";

/**
 * Installing the app to the Home Screen (#400). Android and desktop Chrome hand the page a
 * `beforeinstallprompt` event once it qualifies; iPhone has no such API, so the guide shows the
 * Share, Add to Home Screen steps instead.
 */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export type InstallKind =
  /** Already running as the installed app: nothing to offer. */
  | "installed"
  /** Chrome's own install dialog is available behind one tap. */
  | "native"
  | "ios"
  | "android"
  | "desktop";

let deferred: InstallPromptEvent | null = null;
let installedNow = false;
const listeners = new Set<() => void>();
const notify = () => {
  for (const listener of listeners) listener();
};

/** Call once at startup: the event can fire before any component has mounted. */
export const captureInstallPrompt = (): void => {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferred = event as InstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    installedNow = true;
    notify();
  });
};

export const installKind = (): InstallKind => {
  if (installedNow || isStandalone()) return "installed";
  if (deferred) return "native";
  if (isIosDevice()) return "ios";
  return isAndroidDevice() ? "android" : "desktop";
};

/** A fresh value only changes when the install state does, so it suits `useSyncExternalStore`. */
export const subscribeInstall = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const promptInstall = async (): Promise<"accepted" | "dismissed" | "unavailable"> => {
  const event = deferred;
  if (!event) return "unavailable";
  deferred = null;
  await event.prompt();
  const { outcome } = await event.userChoice;
  notify();
  return outcome;
};

/** The one-time offer after the first league join: pending on join, answered once shown. */
const PENDING_KEY = "postszn-install-pending";
const OFFERED_KEY = "postszn-install-offered";

const read = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const write = (key: string, value: string): boolean => {
  try {
    localStorage.setItem(key, value);
    return localStorage.getItem(key) === value;
  } catch {
    return false;
  }
};

export const installOffered = (): boolean => read(OFFERED_KEY) !== null;

export const markInstallOffered = (): void => {
  write(OFFERED_KEY, "1");
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch {
    // Offered is what matters; a stale pending flag is ignored once it is set.
  }
};

export const markInstallPending = (): void => {
  if (!installOffered()) write(PENDING_KEY, "1");
};

/**
 * The guide is offered on a visit after the one that joined, to a phone that can still install
 * it. Fails closed: without working storage the pending flag never gets set.
 */
export const installOfferDue = (): boolean => {
  const kind = installKind();
  return (
    read(PENDING_KEY) !== null && !installOffered() && kind !== "installed" && kind !== "desktop"
  );
};
