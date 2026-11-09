import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ delete: vi.fn(), post: vi.fn() }));
vi.mock("../api/client", () => ({ api: { delete: mocks.delete, post: mocks.post } }));

import { forgetThisDevice, refreshPushSubscription } from "./pushSetup";

const unsubscribe = vi.fn();
const subscription = {
  endpoint: "https://push.example/device",
  unsubscribe,
  toJSON: () => ({ endpoint: "https://push.example/device" }),
};

const stubBrowser = (existing: unknown) => {
  vi.stubGlobal("PushManager", class {});
  vi.stubGlobal("Notification", { permission: "granted" });
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: { ready: Promise.resolve({ pushManager: { getSubscription: async () => existing } }) },
  });
};

beforeEach(() => {
  mocks.delete.mockReset().mockResolvedValue({});
  mocks.post.mockReset().mockResolvedValue({});
  unsubscribe.mockReset().mockResolvedValue(true);
});

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, "serviceWorker");
});

describe("forgetThisDevice", () => {
  it("deletes the server row and unsubscribes the browser", async () => {
    stubBrowser(subscription);
    await forgetThisDevice();
    expect(mocks.delete).toHaveBeenCalledWith("/api/push/subscriptions", {
      data: { endpoint: subscription.endpoint },
    });
    expect(unsubscribe).toHaveBeenCalled();
  });

  it("does nothing without a subscription or push support", async () => {
    stubBrowser(null);
    await forgetThisDevice();
    Reflect.deleteProperty(navigator, "serviceWorker");
    await forgetThisDevice();
    expect(mocks.delete).not.toHaveBeenCalled();
  });

  it("never throws when the server call fails", async () => {
    stubBrowser(subscription);
    mocks.delete.mockRejectedValue(new Error("offline"));
    await expect(forgetThisDevice()).resolves.toBeUndefined();
  });
});

describe("refreshPushSubscription", () => {
  it("re-posts the existing subscription", async () => {
    stubBrowser(subscription);
    await refreshPushSubscription();
    expect(mocks.post).toHaveBeenCalledWith("/api/push/subscriptions", subscription.toJSON());
  });
});
