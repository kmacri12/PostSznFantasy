import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

const SOURCE = readFileSync(resolve(__dirname, "../public/sw.js"), "utf8");
const ORIGIN = "https://postsznfantasy.com";
const API = "https://api.postsznfantasy.com";

type Handler = (event: unknown) => void;

class FakeCache {
  store = new Map<string, Response>();
  async put(key: string | Request, response: Response) {
    this.store.set(typeof key === "string" ? new URL(key, ORIGIN).href : key.url, response);
  }
  async match(key: string | Request) {
    const found = this.store.get(typeof key === "string" ? new URL(key, ORIGIN).href : key.url);
    return found?.clone();
  }
}

const boot = (
  search = "",
  online = true,
  answer: (url: string, call: number) => Response | null = () => null,
) => {
  const handlers = new Map<string, Handler>();
  const caches = new Map<string, FakeCache>();
  const net = { online, calls: [] as string[] };
  const self = {
    location: { href: `${ORIGIN}/sw.js${search}`, origin: ORIGIN },
    addEventListener: (type: string, handler: Handler) => handlers.set(type, handler),
    skipWaiting: vi.fn(),
    clients: { claim: vi.fn() },
  };
  const cacheStorage = {
    open: async (name: string) => {
      if (!caches.has(name)) caches.set(name, new FakeCache());
      return caches.get(name) as FakeCache;
    },
    keys: async () => [...caches.keys()],
    delete: async (name: string) => caches.delete(name),
  };
  const fetchStub = async (request: Request) => {
    net.calls.push(request.url);
    if (!net.online) throw new TypeError("Failed to fetch");
    const custom = answer(request.url, net.calls.length);
    if (custom) return custom;
    return new Response(JSON.stringify({ at: net.calls.length }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  new Function("self", "caches", "fetch", SOURCE)(self, cacheStorage, fetchStub);
  const dispatch = async (url: string, init: { method?: string; mode?: string } = {}) => {
    const request = new Request(url, { method: init.method ?? "GET" });
    if (init.mode) Object.defineProperty(request, "mode", { value: init.mode });
    let answer: Promise<Response> | undefined;
    const waits: Promise<unknown>[] = [];
    handlers.get("fetch")?.({
      request,
      respondWith: (promise: Promise<Response>) => {
        answer = promise;
      },
      waitUntil: (promise: Promise<unknown>) => waits.push(promise),
    });
    const response = answer ? await answer : null;
    await Promise.all(waits);
    return response;
  };
  const activate = async () => {
    const waits: Promise<unknown>[] = [];
    handlers.get("activate")?.({ waitUntil: (promise: Promise<unknown>) => waits.push(promise) });
    await Promise.all(waits);
  };
  return { dispatch, caches, net, activate };
};

describe("sw.js caching", () => {
  it("replays the last standings, stamped, when the network is gone", async () => {
    const sw = boot();
    const live = await sw.dispatch(`${API}/api/seasons/5/standings`);
    expect(await live?.json()).toEqual({ at: 1 });
    sw.net.online = false;
    const replay = await sw.dispatch(`${API}/api/seasons/5/standings`);
    expect(await replay?.json()).toEqual({ at: 1 });
    expect(Number(replay?.headers.get("X-Cached-At"))).toBeGreaterThan(0);
  });

  it("keeps lineups and the league list too", async () => {
    const sw = boot();
    for (const path of ["/api/teams/9", "/api/leagues/user-leagues", "/api/leagues/3/seasons"]) {
      await sw.dispatch(`${API}${path}`);
    }
    sw.net.online = false;
    for (const path of ["/api/teams/9", "/api/leagues/user-leagues", "/api/leagues/3/seasons"]) {
      expect((await sw.dispatch(`${API}${path}`))?.status).toBe(200);
    }
  });

  it("fails normally for data it never saw", async () => {
    const sw = boot("", false);
    await expect(sw.dispatch(`${API}/api/seasons/5/standings`)).rejects.toThrow("Failed to fetch");
  });

  it("never touches writes, chat, the feed, push or avatars", async () => {
    const sw = boot();
    expect(await sw.dispatch(`${API}/api/teams/9/lineup`, { method: "POST" })).toBeNull();
    for (const path of [
      "/api/seasons/5/feed",
      "/api/seasons/5/messages",
      "/api/push/preferences",
      "/api/avatars/abc",
      "/api/notifications",
      "/api/auth/login",
    ]) {
      expect(await sw.dispatch(`${API}${path}`)).toBeNull();
    }
    expect(sw.caches.size).toBe(0);
  });

  it("opens the app offline from the saved shell, but not an invite page", async () => {
    const sw = boot();
    await sw.dispatch(`${ORIGIN}/leagues/1/feed`, { mode: "navigate" });
    await sw.dispatch(`${ORIGIN}/join/ABC`, { mode: "navigate" });
    sw.net.online = false;
    const shell = await sw.dispatch(`${ORIGIN}/leagues/1`, { mode: "navigate" });
    expect(await shell?.json()).toEqual({ at: 1 });
  });

  it("serves fingerprinted assets from the cache after the first load", async () => {
    const sw = boot();
    await sw.dispatch(`${ORIGIN}/assets/index-abc.js`);
    await sw.dispatch(`${ORIGIN}/assets/index-abc.js`);
    expect(sw.net.calls).toHaveLength(1);
  });

  it("never keeps index.html under a page file's name (a deploy still publishing)", async () => {
    const html = (call: number) =>
      call === 1
        ? new Response("<!doctype html>", { status: 200, headers: { "Content-Type": "text/html" } })
        : new Response("export default 1", {
            status: 200,
            headers: { "Content-Type": "text/javascript" },
          });
    const sw = boot("", true, (_url, call) => html(call));
    const first = await sw.dispatch(`${ORIGIN}/assets/LeaguePage-new.js`);
    expect(await first?.text()).toBe("<!doctype html>");
    // The retry reaches the network again and now gets the real file, which is kept.
    const second = await sw.dispatch(`${ORIGIN}/assets/LeaguePage-new.js`);
    expect(await second?.text()).toBe("export default 1");
    await sw.dispatch(`${ORIGIN}/assets/LeaguePage-new.js`);
    expect(sw.net.calls).toHaveLength(2);
  });

  it("ignores an index.html an older worker kept under a page file's name", async () => {
    const sw = boot(
      "",
      true,
      () => new Response("export default 1", { headers: { "Content-Type": "text/javascript" } }),
    );
    const cache = new FakeCache();
    sw.caches.set("ps-shell-v2", cache);
    await cache.put(
      `${ORIGIN}/assets/LeaguePage-new.js`,
      new Response("<!doctype html>", { headers: { "Content-Type": "text/html" } }),
    );
    const answer = await sw.dispatch(`${ORIGIN}/assets/LeaguePage-new.js`);
    expect(await answer?.text()).toBe("export default 1");
  });

  it("activates by deleting the old shell cache but keeping the current caches", async () => {
    const sw = boot();
    await sw.dispatch(`${ORIGIN}/assets/index-abc.js`);
    sw.caches.set("ps-shell-v1", new FakeCache());
    await sw.activate();
    expect([...sw.caches.keys()].sort()).toEqual(["ps-shell-v2"]);
  });

  it("does nothing at all for the e2e build (?nocache)", async () => {
    const sw = boot("?nocache=1");
    expect(await sw.dispatch(`${API}/api/seasons/5/standings`)).toBeNull();
    expect(await sw.dispatch(`${ORIGIN}/`, { mode: "navigate" })).toBeNull();
  });

  it("still handles push and notification taps", () => {
    const source = SOURCE;
    expect(source).toContain('addEventListener("push"');
    expect(source).toContain('addEventListener("notificationclick"');
  });
});
