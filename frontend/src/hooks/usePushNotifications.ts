import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import { createLogger } from "../utils/logger";
import {
  isIosDevice,
  isStandalone,
  pushApisAvailable,
  urlBase64ToUint8Array,
} from "../utils/pushSetup";

const log = createLogger("push");

export type PushStatus =
  | "loading"
  /** No push in this browser. */
  | "unsupported"
  /** iPhone or iPad in a normal tab: add the site to the Home Screen first. */
  | "needs-install"
  /** The server has no VAPID keys. */
  | "unconfigured"
  /** The user blocked notifications in the browser; only they can undo that. */
  | "denied"
  | "off"
  | "on";

export interface PushNotifications {
  status: PushStatus;
  busy: boolean;
  error: string | null;
  /** Asks for permission, so call it only from a tap. */
  enable: () => Promise<void>;
  disable: () => Promise<void>;
}

const readVapidKey = async (): Promise<string | null> =>
  (await api.get<{ publicKey: string | null }>("/api/push/vapid-key")).data.publicKey;

const saveSubscription = (subscription: PushSubscription) =>
  api.post("/api/push/subscriptions", subscription.toJSON());

export const usePushNotifications = (): PushNotifications => {
  const [status, setStatus] = useState<PushStatus>("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const detect = async (): Promise<PushStatus> => {
      if (isIosDevice() && !isStandalone()) return "needs-install";
      if (!pushApisAvailable()) return "unsupported";
      if ((await readVapidKey()) === null) return "unconfigured";
      if (Notification.permission === "denied") return "denied";
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      if (!existing) return "off";
      // Refreshes the server's copy, which may have been pruned or moved to another account.
      await saveSubscription(existing);
      return "on";
    };
    detect()
      .then((next) => !cancelled && setStatus(next))
      .catch((failure) => {
        log.warn("Could not read push state", failure);
        if (!cancelled) setStatus("unsupported");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const enable = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "off");
        return;
      }
      const publicKey = await readVapidKey();
      if (publicKey === null) {
        setStatus("unconfigured");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      await saveSubscription(subscription);
      setStatus("on");
    } catch (failure) {
      log.warn("Could not turn notifications on", failure);
      setError("Couldn't turn notifications on. Try again.");
    } finally {
      setBusy(false);
    }
  }, []);

  const disable = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await api.delete("/api/push/subscriptions", { data: { endpoint: subscription.endpoint } });
        await subscription.unsubscribe();
      }
      setStatus("off");
    } catch (failure) {
      log.warn("Could not turn notifications off", failure);
      setError("Couldn't turn notifications off. Try again.");
    } finally {
      setBusy(false);
    }
  }, []);

  return { status, busy, error, enable, disable };
};
