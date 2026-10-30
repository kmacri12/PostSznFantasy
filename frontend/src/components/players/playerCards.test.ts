import { describe, expect, it } from "vitest";
import { filterPlayerCards, type PlayerCardData } from "./playerCards";

const card = (id: number, name: string, position: string, extra = {}): PlayerCardData => ({
  id,
  name,
  position,
  team: "KC",
  ...extra,
});
const all = [
  card(1, "Pat Mahomes", "QB"),
  card(2, "Josh Allen", "QB"),
  card(3, "Travis Kelce", "TE"),
  card(4, "Out Guy", "WR", { eliminated: true }),
];

const ids = (list: PlayerCardData[]) => list.map((p) => p.id);

describe("filterPlayerCards", () => {
  it("hides eliminated players", () => {
    expect(ids(filterPlayerCards(all, { search: "", position: null }))).toEqual([1, 2, 3]);
  });

  it("hides drafted players", () => {
    const hiddenIds = new Set([2]);
    expect(ids(filterPlayerCards(all, { search: "", position: null, hiddenIds }))).toEqual([1, 3]);
  });

  it("filters by position and case-insensitive search", () => {
    expect(ids(filterPlayerCards(all, { search: "", position: "TE" }))).toEqual([3]);
    expect(ids(filterPlayerCards(all, { search: " ALLEN ", position: "QB" }))).toEqual([2]);
  });
});
