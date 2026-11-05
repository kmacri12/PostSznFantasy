import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePushNotifications } from "./usePushNotifications";

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), delete: vi.fn() }));
vi.mock("../api/client", () => ({ api: mocks }));

const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148";

const subscriptionJson = {
  endpoint: "https://fcm.googleapis.com/x",
  keys: { p256dh: "k", auth: "a" },
};

const makeSubscription = () => ({
  endpoint: subscriptionJson.endpoint,
  toJSON: () => subscriptionJson,
  unsubscribe: vi.fn().mockResolvedValue(true),
});

interface Browser {
  existing: ReturnType<typeof makeSubscription> | null;
  subscribe: ReturnType<typeof vi.fn>;
  requestPermission: ReturnType<typeof vi.fn>;
}

const installBrowser = (options: { permission?: NotificationPermission } = {}): Browser => {
  const browser: Browser = {
    existing: null,
    subscribe: vi.fn(async () => makeSubscription()),
    requestPermission: vi.fn().mockResolvedValue("granted"),
  };
  const registration = {
    pushManager: {
      getSubscription: vi.fn(async () => browser.existing),
      subscribe: browser.subscribe,
    },
  };
  vi.stubGlobal("PushManager", class {});
  vi.stubGlobal("Notification", {
    permission: options.permission ?? "default",
    requestPermission: browser.requestPermission,
  });
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: { ready: Promise.resolve(registration) },
  });
  return browser;
};

const setUserAgent = (value: string) =>
  Object.defineProperty(navigator, "userAgent", { configurable: true, value });

describe("usePushNotifications", () => {
  const originalUserAgent = navigator.userAgent;

  beforeEach(() => {
    mocks.get.mockReset().mockResolvedValue({ data: { publicKey: "AQAB" } });
    mocks.post.mockReset().mockResolvedValue({});
    mocks.delete.mockReset().mockResolvedValue({});
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    // jsdom has no PushManager of its own
    Reflect.deleteProperty(navigator, "serviceWorker");
    setUserAgent(originalUserAgent);
  });

  it("is unsupported without the push APIs", async () => {
    const { result } = renderHook(() => usePushNotifications());
    await waitFor(() => expect(result.current.status).toBe("unsupported"));
  });

  it("asks an iPhone tab to add the site to the Home Screen first", async () => {
    installBrowser();
    setUserAgent(IPHONE_UA);
    const { result } = renderHook(() => usePushNotifications());
    await waitFor(() => expect(result.current.status).toBe("needs-install"));
    expect(mocks.get).not.toHaveBeenCalled();
  });

  it("works on an iPhone once installed to the Home Screen", async () => {
    installBrowser();
    setUserAgent(IPHONE_UA);
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    const { result } = renderHook(() => usePushNotifications());
    await waitFor(() => expect(result.current.status).toBe("off"));
  });

  it("is unconfigured when the server has no VAPID key", async () => {
    installBrowser();
    mocks.get.mockResolvedValue({ data: { publicKey: null } });
    const { result } = renderHook(() => usePushNotifications());
    await waitFor(() => expect(result.current.status).toBe("unconfigured"));
  });

  it("reports blocked notifications", async () => {
    installBrowser({ permission: "denied" });
    const { result } = renderHook(() => usePushNotifications());
    await waitFor(() => expect(result.current.status).toBe("denied"));
  });

  it("is on, and refreshes the server copy, when the device is already subscribed", async () => {
    const browser = installBrowser();
    browser.existing = makeSubscription();
    const { result } = renderHook(() => usePushNotifications());
    await waitFor(() => expect(result.current.status).toBe("on"));
    expect(mocks.post).toHaveBeenCalledWith("/api/push/subscriptions", subscriptionJson);
  });

  it("asks permission only when enable is called, then subscribes and saves", async () => {
    const browser = installBrowser();
    const { result } = renderHook(() => usePushNotifications());
    await waitFor(() => expect(result.current.status).toBe("off"));
    expect(browser.requestPermission).not.toHaveBeenCalled();

    await act(() => result.current.enable());

    expect(browser.requestPermission).toHaveBeenCalledOnce();
    expect(browser.subscribe).toHaveBeenCalledWith({
      userVisibleOnly: true,
      applicationServerKey: new Uint8Array([1, 0, 1]),
    });
    expect(mocks.post).toHaveBeenCalledWith("/api/push/subscriptions", subscriptionJson);
    expect(result.current.status).toBe("on");
  });

  it("does not subscribe when permission is refused", async () => {
    const browser = installBrowser();
    browser.requestPermission.mockResolvedValue("denied");
    const { result } = renderHook(() => usePushNotifications());
    await waitFor(() => expect(result.current.status).toBe("off"));

    await act(() => result.current.enable());

    expect(browser.subscribe).not.toHaveBeenCalled();
    expect(result.current.status).toBe("denied");
  });

  it("shows an error and stays off when subscribing fails", async () => {
    const browser = installBrowser();
    browser.subscribe.mockRejectedValue(new Error("push service down"));
    const { result } = renderHook(() => usePushNotifications());
    await waitFor(() => expect(result.current.status).toBe("off"));

    await act(() => result.current.enable());

    expect(result.current.status).toBe("off");
    expect(result.current.error).toMatch(/try again/i);
  });

  it("disable removes the server copy and unsubscribes the device", async () => {
    const browser = installBrowser();
    const existing = makeSubscription();
    browser.existing = existing;
    const { result } = renderHook(() => usePushNotifications());
    await waitFor(() => expect(result.current.status).toBe("on"));

    await act(() => result.current.disable());

    expect(mocks.delete).toHaveBeenCalledWith("/api/push/subscriptions", {
      data: { endpoint: subscriptionJson.endpoint },
    });
    expect(existing.unsubscribe).toHaveBeenCalled();
    expect(result.current.status).toBe("off");
  });
});
