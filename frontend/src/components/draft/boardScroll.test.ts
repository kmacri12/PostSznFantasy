import { describe, expect, it } from "vitest";
import { centeredScroll } from "./boardScroll";

describe("centeredScroll", () => {
  it("centres the cell beside the pinned header", () => {
    // 300px viewport, 50px pinned: visible 250, cell 100 starting at 600 -> 600-50-75
    expect(centeredScroll(600, 100, 300, 50, 2000)).toBe(475);
  });

  it("never scrolls before the start", () => {
    expect(centeredScroll(60, 100, 300, 50, 2000)).toBe(0);
  });

  it("never scrolls past the end", () => {
    expect(centeredScroll(1950, 100, 300, 50, 2000)).toBe(1700);
  });

  it("does not scroll when the content fits", () => {
    expect(centeredScroll(100, 100, 300, 50, 250)).toBe(0);
  });
});
