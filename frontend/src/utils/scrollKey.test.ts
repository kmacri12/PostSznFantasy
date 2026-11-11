import { describe, expect, it } from "vitest";
import { scrollKey } from "./scrollKey";

describe("scrollKey", () => {
  it("keys ordinary pages by path so a tab return restores the position", () => {
    expect(scrollKey({ pathname: "/leagues/1/draft", key: "a" })).toBe("/leagues/1/draft");
    expect(scrollKey({ pathname: "/leagues/1/draft", key: "b" })).toBe("/leagues/1/draft");
  });

  it("keys the Feed by history entry so a fresh visit opens at the newest message", () => {
    expect(scrollKey({ pathname: "/leagues/1/feed", key: "a" })).toBe("a");
    expect(scrollKey({ pathname: "/leagues/1/seasons/2025/feed", key: "b" })).toBe("b");
  });
});
