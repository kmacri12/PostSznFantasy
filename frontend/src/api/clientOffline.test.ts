import type { AxiosAdapter, InternalAxiosRequestConfig } from "axios";
import { AxiosError } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../utils/supabase", () => ({
  supabaseAuth: {
    getSession: async () => ({ data: { session: null } }),
    refreshSession: async () => ({ data: { session: null } }),
  },
}));
vi.mock("../utils/appVersion", () => ({ BUILD_TIME: 1700000000 }));

import { friendlyError } from "../components/common/friendlyError";
import { freshAtSnapshot, resetFresh } from "../utils/dataFreshness";
import { appOutdatedSnapshot, resetAppOutdated } from "./appOutdated";
import { api, OFFLINE_WRITE_REASON } from "./client";

const seen: InternalAxiosRequestConfig[] = [];
let respond: (config: InternalAxiosRequestConfig) => ReturnType<AxiosAdapter>;

const setOnline = (online: boolean) =>
  Object.defineProperty(navigator, "onLine", { configurable: true, value: online });

beforeEach(() => {
  seen.length = 0;
  resetFresh();
  resetAppOutdated();
  setOnline(true);
  respond = async (config) => ({ data: {}, status: 200, statusText: "OK", headers: {}, config });
  api.defaults.adapter = async (config) => {
    seen.push(config);
    return respond(config);
  };
});
afterEach(() => setOnline(true));

describe("offline", () => {
  it("refuses a write with a readable reason and never sends it", async () => {
    setOnline(false);
    const failure = await api.post("/api/teams/1/lineup", {}).catch((error) => error);
    expect(friendlyError(failure, "fallback")).toBe(OFFLINE_WRITE_REASON);
    expect(seen).toHaveLength(0);
  });

  it("still sends reads", async () => {
    setOnline(false);
    await api.get("/api/seasons/1/standings");
    expect(seen).toHaveLength(1);
  });

  it("dates the data by the service worker's stamp when it replays a cached answer", async () => {
    respond = async (config) => ({
      data: {},
      status: 200,
      statusText: "OK",
      headers: { "x-cached-at": "1731340000000" },
      config,
    });
    await api.get("/api/seasons/1/standings");
    expect(freshAtSnapshot()).toBe(1731340000000);
  });

  it("dates a live answer as now", async () => {
    const before = Date.now();
    await api.get("/api/seasons/1/standings");
    expect(freshAtSnapshot()).toBeGreaterThanOrEqual(before);
  });
});

describe("app version", () => {
  it("sends the build time", async () => {
    await api.get("/api/config");
    expect(seen[0]?.headers["X-App-Version"]).toBe("1700000000");
  });

  it("flags a 426 app_outdated and leaves other errors alone", async () => {
    const refuse = (status: number, code: string) => async (config: InternalAxiosRequestConfig) => {
      throw new AxiosError("refused", "ERR_BAD_REQUEST", config, null, {
        status,
        statusText: "",
        headers: {},
        config,
        data: { detail: "Please refresh", code },
      });
    };
    respond = refuse(409, "app_outdated");
    await api.get("/api/config").catch(() => undefined);
    expect(appOutdatedSnapshot()).toBe(false);
    respond = refuse(426, "app_outdated");
    await api.get("/api/config").catch(() => undefined);
    expect(appOutdatedSnapshot()).toBe(true);
  });
});
