import { afterEach, describe, expect, it, vi } from "vitest";
import { celebrationSeen, markCelebrationSeen } from "./celebrationSeen";

describe("celebrationSeen", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("remembers per kind and id", () => {
    expect(celebrationSeen("champion", 7)).toBe(false);
    markCelebrationSeen("champion", 7);
    expect(celebrationSeen("champion", 7)).toBe(true);
    expect(celebrationSeen("champion", 8)).toBe(false);
    expect(celebrationSeen("round", 7)).toBe(false);
  });

  it("fails closed when storage is unavailable", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    });
    expect(celebrationSeen("champion", 1)).toBe(true);
    expect(() => markCelebrationSeen("champion", 1)).not.toThrow();
  });
});
