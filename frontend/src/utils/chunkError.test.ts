import { afterEach, describe, expect, it, vi } from "vitest";
import { clearShellCaches } from "./chunkError";

afterEach(() => vi.unstubAllGlobals());

describe("clearShellCaches", () => {
  it("deletes every app-shell cache but leaves the rest alone", async () => {
    const names = ["ps-shell-v1", "ps-shell-v2", "ps-data-v1", "other"];
    const deleted: string[] = [];
    vi.stubGlobal("caches", {
      keys: async () => names,
      delete: async (name: string) => deleted.push(name),
    });
    await clearShellCaches();
    expect(deleted.sort()).toEqual(["ps-shell-v1", "ps-shell-v2"]);
  });

  it("does nothing where the Cache API is missing or fails", async () => {
    vi.stubGlobal("caches", undefined);
    await expect(clearShellCaches()).resolves.toBeUndefined();
    vi.stubGlobal("caches", {
      keys: async () => {
        throw new Error("blocked");
      },
    });
    await expect(clearShellCaches()).resolves.toBeUndefined();
  });
});
