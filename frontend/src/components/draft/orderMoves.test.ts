import { describe, expect, it } from "vitest";
import { moveTeam, sameOrder } from "./orderMoves";

describe("moveTeam", () => {
  it("swaps a team with its neighbour", () => {
    expect(moveTeam([1, 2, 3], 1, -1)).toEqual([2, 1, 3]);
    expect(moveTeam([1, 2, 3], 1, 1)).toEqual([1, 3, 2]);
  });

  it("changes nothing past either end", () => {
    expect(moveTeam([1, 2, 3], 0, -1)).toEqual([1, 2, 3]);
    expect(moveTeam([1, 2, 3], 2, 1)).toEqual([1, 2, 3]);
  });
});

describe("sameOrder", () => {
  it("compares positions", () => {
    expect(sameOrder([1, 2], [1, 2])).toBe(true);
    expect(sameOrder([1, 2], [2, 1])).toBe(false);
  });
});
