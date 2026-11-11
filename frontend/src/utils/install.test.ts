import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../api/client", () => ({ api: {} }));

const loadFresh = async () => {
  vi.resetModules();
  return import("./install");
};

const setUserAgent = (value: string) =>
  Object.defineProperty(navigator, "userAgent", { configurable: true, value });

const standalone = (on: boolean) =>
  vi.stubGlobal("matchMedia", () => ({
    matches: on,
    addEventListener() {},
    removeEventListener() {},
  }));

beforeEach(() => {
  localStorage.clear();
  standalone(false);
  setUserAgent("Mozilla/5.0 (X11; Linux x86_64) Chrome/120");
});
afterEach(() => vi.unstubAllGlobals());

describe("installKind", () => {
  it("is installed when running as the Home Screen app", async () => {
    standalone(true);
    expect((await loadFresh()).installKind()).toBe("installed");
  });

  it("tells iPhone, Android and desktop apart", async () => {
    setUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1");
    expect((await loadFresh()).installKind()).toBe("ios");
    setUserAgent("Mozilla/5.0 (Linux; Android 14) Chrome/120 Mobile");
    expect((await loadFresh()).installKind()).toBe("android");
    setUserAgent("Mozilla/5.0 (X11; Linux x86_64) Chrome/120");
    expect((await loadFresh()).installKind()).toBe("desktop");
  });

  it("uses Chrome's own prompt once the browser offers it", async () => {
    const install = await loadFresh();
    install.captureInstallPrompt();
    const prompt = vi.fn().mockResolvedValue(undefined);
    const event = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
      prompt,
      userChoice: Promise.resolve({ outcome: "accepted" as const }),
    });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(install.installKind()).toBe("native");
    expect(await install.promptInstall()).toBe("accepted");
    expect(prompt).toHaveBeenCalledOnce();
    expect(await install.promptInstall()).toBe("unavailable");
  });

  it("becomes installed on appinstalled", async () => {
    const install = await loadFresh();
    install.captureInstallPrompt();
    const listener = vi.fn();
    install.subscribeInstall(listener);
    window.dispatchEvent(new Event("appinstalled"));
    expect(install.installKind()).toBe("installed");
    expect(listener).toHaveBeenCalled();
  });
});

describe("the one-time offer", () => {
  const phone = () =>
    setUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1");

  it("is not due until a league was joined", async () => {
    phone();
    expect((await loadFresh()).installOfferDue()).toBe(false);
  });

  it("is due after a join, once, on a phone", async () => {
    phone();
    const install = await loadFresh();
    install.markInstallPending();
    expect(install.installOfferDue()).toBe(true);
    install.markInstallOffered();
    expect(install.installOfferDue()).toBe(false);
    install.markInstallPending();
    expect(install.installOfferDue()).toBe(false);
  });

  it("is never due for the installed app or a desktop browser", async () => {
    const install = await loadFresh();
    install.markInstallPending();
    expect(install.installOfferDue()).toBe(false);
    standalone(true);
    phone();
    expect((await loadFresh()).installOfferDue()).toBe(false);
  });

  it("fails closed without storage", async () => {
    phone();
    const install = await loadFresh();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    install.markInstallPending();
    expect(install.installOfferDue()).toBe(false);
    vi.restoreAllMocks();
  });
});
