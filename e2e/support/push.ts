import type { Page } from "@playwright/test";

interface PushStub {
  /** What the browser's permission popup answers when the app asks. */
  answer: "granted" | "denied";
  /** The permission the browser starts with (a blocked site starts "denied"). */
  permission?: "default" | "denied";
}

export const ANDROID_USER_AGENT =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";

// A well-formed VAPID public key (65 bytes, base64url) from the web-push documentation; nothing verifies it here.
const FAKE_VAPID_KEY =
  "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U";

/**
 * Replaces everything push-related that a headless browser or the test API cannot do:
 * the permission popup, the push service subscription and the API's VAPID key. Counts
 * what the app asked for, readable with `pushStubCalls`.
 */
export const stubPush = async (page: Page, { answer, permission = "default" }: PushStub) => {
  await page.addInitScript(
    ({ answer: reply, permission: initial }) => {
      const KEY = "e2e-push-subscribed";
      const state = { permission: initial as NotificationPermission, asked: 0, subscribed: 0 };
      (window as unknown as { __pushStub: typeof state }).__pushStub = state;
      Object.defineProperty(Notification, "permission", { get: () => state.permission });
      Notification.requestPermission = async () => {
        state.asked += 1;
        state.permission = reply;
        return reply;
      };
      const fake = {
        endpoint: "https://fcm.googleapis.com/fcm/send/e2e-device",
        toJSON: () => ({
          endpoint: "https://fcm.googleapis.com/fcm/send/e2e-device",
          keys: { p256dh: "e2e-p256dh", auth: "e2e-auth" },
        }),
        unsubscribe: async () => {
          sessionStorage.removeItem(KEY);
          return true;
        },
      };
      // The subscription lives in sessionStorage so it survives reloads like the browser's own.
      PushManager.prototype.getSubscription = async () =>
        (sessionStorage.getItem(KEY) ? fake : null) as unknown as PushSubscription | null;
      PushManager.prototype.subscribe = async () => {
        state.subscribed += 1;
        sessionStorage.setItem(KEY, "1");
        return fake as unknown as PushSubscription;
      };
    },
    { answer, permission },
  );
  await page.route("**/api/push/vapid-key", (route) =>
    route.fulfill({ json: { publicKey: FAKE_VAPID_KEY } }),
  );
  await page.route("**/api/push/subscriptions", (route) => route.fulfill({ status: 204 }));
};

export const pushStubCalls = (page: Page) =>
  page.evaluate(() => {
    const { asked, subscribed } = (
      window as unknown as { __pushStub: { asked: number; subscribed: number } }
    ).__pushStub;
    return { asked, subscribed };
  });
