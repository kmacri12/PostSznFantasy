import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchDeployedBuild, isNewerBuild, parseBuiltAt, updatePromptAllowed } from "./appVersion";

afterEach(() => vi.unstubAllGlobals());

describe("version.json", () => {
  it("reads builtAt and ignores anything else", () => {
    expect(parseBuiltAt({ builtAt: 1700000000 })).toBe(1700000000);
    expect(parseBuiltAt({ builtAt: "1700000000" })).toBeNull();
    expect(parseBuiltAt(null)).toBeNull();
    expect(parseBuiltAt({})).toBeNull();
  });

  it("only a strictly newer deploy is an update", () => {
    expect(isNewerBuild(200, 100)).toBe(true);
    expect(isNewerBuild(100, 100)).toBe(false);
    expect(isNewerBuild(50, 100)).toBe(false);
    expect(isNewerBuild(null, 100)).toBe(false);
  });

  it("is null when the file is missing, not JSON or the network is down", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    expect(await fetchDeployedBuild()).toBeNull();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.reject(new SyntaxError("<!doctype")),
      }),
    );
    expect(await fetchDeployedBuild()).toBeNull();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    expect(await fetchDeployedBuild()).toBeNull();
  });

  it("reads the deployed build", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ builtAt: 1800000000 }) }),
    );
    expect(await fetchDeployedBuild()).toBe(1800000000);
  });
});

describe("updatePromptAllowed", () => {
  const field = (tag: string) => document.createElement(tag);

  it("never prompts in the draft room, board included", () => {
    expect(updatePromptAllowed("/leagues/1/draft", null)).toBe(false);
    expect(updatePromptAllowed("/leagues/1/seasons/2025/draft/board", null)).toBe(false);
  });

  it("waits while a field is being typed in", () => {
    expect(updatePromptAllowed("/leagues/1", field("input"))).toBe(false);
    expect(updatePromptAllowed("/leagues/1/feed", field("textarea"))).toBe(false);
    const editable = field("div");
    Object.defineProperty(editable, "isContentEditable", { value: true });
    expect(updatePromptAllowed("/leagues/1/feed", editable)).toBe(false);
  });

  it("prompts elsewhere", () => {
    expect(updatePromptAllowed("/leagues/1", null)).toBe(true);
    expect(updatePromptAllowed("/leagues/1/feed", field("button"))).toBe(true);
    expect(updatePromptAllowed("/leagues/1/drafts-archive", null)).toBe(true);
  });
});
