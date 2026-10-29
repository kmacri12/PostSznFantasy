import { describe, expect, it } from "vitest";
import {
  type PlayerSeasonStats,
  filterPlayers,
  formatPoints,
  sortPlayers,
  teamOf,
} from "./playerStats";

const row = (
  name: string,
  position: string,
  fantasyPoints: number | null,
  extra = {},
): PlayerSeasonStats => ({
  season: "2025",
  playerId: 1,
  player: { name, position, teamAbv: "KC" },
  fantasyPoints,
  ...extra,
});

const rows = [
  row("Bo RB", "RB", 150.2),
  row("Al WR", "WR", 210.5),
  row("Cy QB", "QB", 320),
  row("Di TE", "TE", null),
];

describe("player list helpers", () => {
  it("filters by position, FLX and search", () => {
    expect(filterPlayers(rows, "QB", "").map((r) => r.player?.name)).toEqual(["Cy QB"]);
    expect(filterPlayers(rows, "FLX", "").map((r) => r.player?.name)).toEqual([
      "Bo RB",
      "Al WR",
      "Di TE",
    ]);
    expect(filterPlayers(rows, "FLX", "al").map((r) => r.player?.name)).toEqual(["Al WR"]);
  });

  it("sorts by fantasy points high to low, with unscored players last", () => {
    expect(sortPlayers(rows, "fantasyPoints").map((r) => r.player?.name)).toEqual([
      "Cy QB",
      "Al WR",
      "Bo RB",
      "Di TE",
    ]);
  });

  it("sorts by a stat or by name", () => {
    const withYards = [
      row("A", "QB", 1, { passingYards: 100 }),
      row("B", "QB", 2, { passingYards: 900 }),
    ];
    expect(sortPlayers(withYards, "passingYards").map((r) => r.player?.name)).toEqual(["B", "A"]);
    expect(sortPlayers(rows, "name").map((r) => r.player?.name)).toEqual([
      "Al WR",
      "Bo RB",
      "Cy QB",
      "Di TE",
    ]);
  });

  it("formats points and falls back for team", () => {
    expect(formatPoints(12.345)).toBe("12.3");
    expect(formatPoints(null)).toBe("—");
    expect(teamOf({ season: "2025", playerId: 2 })).toBe("FA");
  });
});
