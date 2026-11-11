import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  cachedAtOf,
  formatDataTime,
  freshAtSnapshot,
  recordFresh,
  resetFresh,
  subscribeFresh,
} from "./dataFreshness";

beforeEach(resetFresh);

describe("dataFreshness", () => {
  it("keeps the newest answer and tells subscribers", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeFresh(listener);
    recordFresh(1000);
    recordFresh(500);
    expect(freshAtSnapshot()).toBe(1000);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    recordFresh(2000);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("reads the service worker's stamp from response headers", () => {
    expect(cachedAtOf({ "x-cached-at": "1731340000000" })).toBe(1731340000000);
    expect(cachedAtOf({ "x-cached-at": "soon" })).toBeNull();
    expect(cachedAtOf({})).toBeNull();
    expect(cachedAtOf(undefined)).toBeNull();
  });

  it("formats a clock time", () => {
    expect(formatDataTime(new Date(2026, 0, 10, 15, 42).getTime())).toMatch(/3:42/);
  });
});
