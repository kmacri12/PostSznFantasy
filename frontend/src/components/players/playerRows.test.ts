import { describe, expect, it } from "vitest";
import type { DraftPick, LeagueSettings, PlayerSummary } from "../../api/types";
import {
  buildPlayerRows,
  filterRows,
  flexPositions,
  ownersByPlayer,
  type PlayerFilters,
  type SeasonStatsRow,
  sortOptions,
  sortRows,
  statLine,
} from "./playerRows";

const player = (id: number, name: string, position: string, teamAbv = "BUF"): PlayerSummary => ({
  id,
  name,
  position,
  teamAbv,
});
const stat = (playerId: number, fantasyPoints: number | null, extra = {}): SeasonStatsRow => ({
  playerId,
  fantasyPoints,
  ...extra,
});

const pool = [
  player(1, "Josh Allen", "QB"),
  player(2, "Puka Nacua", "WR", "LAR"),
  player(3, "James Cook", "RB"),
  player(4, "Tyler Bass", "K"),
];
const stats = [
  stat(1, 318.4, { passingYards: 4306, passingTouchdowns: 31, passingInterceptions: 11 }),
  stat(2, 291, { receivingReceptions: 129, receivingYards: 1715, receivingTouchdowns: 10 }),
  stat(4, 148, { kickingFgMade: 31, kickingFgMissed: 4, kickingXpMade: 38, kickingXpMissed: 1 }),
];
const rows = buildPlayerRows(pool, stats);
const none: PlayerFilters = {
  search: "",
  position: null,
  nflTeam: null,
  fantasyTeamId: null,
  availability: "all",
};
const pick = (playerId: number, teamId: number): DraftPick =>
  ({ playerId, teamId, numberRound: 1, numberPickInRound: 3 }) as DraftPick;

describe("statLine", () => {
  it("reads the regular season for each position", () => {
    expect(statLine("QB", stats[0])).toBe("4,306 yds, 31 TD, 11 INT");
    expect(statLine("WR", stats[1])).toBe("129 rec, 1,715 yds, 10 TD");
    expect(statLine("K", stats[2])).toBe("31/35 FG, 38/39 XP");
    expect(statLine("RB", stat(3, 1, { rushingYards: 1009, rushingTouchdowns: 16 }))).toBe(
      "1,009 yds, 16 TD",
    );
  });

  it("says so when a player has no regular season stats", () => {
    expect(statLine("RB", undefined)).toBe("No regular season stats");
  });
});

describe("buildPlayerRows", () => {
  it("reads the upstream's PK and DEF as K and DST so the position filters match", () => {
    const built = buildPlayerRows(
      [player(20, "Harrison Butker", "PK"), player(21, "Bills", "DEF")],
      [],
    );
    expect(built.map((row) => row.position)).toEqual(["K", "DST"]);
    expect(filterRows(built, { ...none, position: "K" }, new Map(), null)).toHaveLength(1);
  });

  it("lists the pool, with a missing stat row unscored", () => {
    expect(rows.map((row) => [row.name, row.points])).toEqual([
      ["Josh Allen", 318.4],
      ["Puka Nacua", 291],
      ["James Cook", null],
      ["Tyler Bass", 148],
    ]);
  });

  it("falls back to everyone with a stat row before the playoff field is set", () => {
    const fromStats = buildPlayerRows(
      [],
      [{ ...stats[0], player: pool[0] } as SeasonStatsRow, stat(9, 1)],
    );
    expect(fromStats.map((row) => row.name)).toEqual(["Josh Allen"]);
  });
});

describe("filterRows", () => {
  const owners = ownersByPlayer([pick(2, 20)], () => "Kyle's Kings");

  it("filters by search, position and NFL team", () => {
    expect(filterRows(rows, { ...none, search: "cook" }, owners, null)).toHaveLength(1);
    expect(filterRows(rows, { ...none, position: "K" }, owners, null)).toHaveLength(1);
    expect(filterRows(rows, { ...none, nflTeam: "LAR" }, owners, null)[0]?.name).toBe("Puka Nacua");
  });

  it("FLEX takes the flex positions of the league", () => {
    const flex = ["RB", "WR", "TE"];
    expect(
      filterRows(rows, { ...none, position: "FLEX" }, owners, flex).map((row) => row.name),
    ).toEqual(["Puka Nacua", "James Cook"]);
  });

  it("splits drafted from available and filters by owner", () => {
    expect(
      filterRows(rows, { ...none, availability: "drafted" }, owners, null).map((row) => row.id),
    ).toEqual([2]);
    expect(filterRows(rows, { ...none, availability: "available" }, owners, null)).toHaveLength(3);
    expect(filterRows(rows, { ...none, fantasyTeamId: 20 }, owners, null)).toHaveLength(1);
    expect(filterRows(rows, { ...none, fantasyTeamId: 99 }, owners, null)).toHaveLength(0);
  });
});

describe("sortRows", () => {
  it("puts the highest points first and unscored players last", () => {
    expect(sortRows(rows, "points").map((row) => row.name)).toEqual([
      "Josh Allen",
      "Puka Nacua",
      "Tyler Bass",
      "James Cook",
    ]);
  });

  it("sorts by name and by a stat", () => {
    expect(sortRows(rows, "name")[0]?.name).toBe("James Cook");
    expect(sortRows(rows, "receivingYards")[0]?.name).toBe("Puka Nacua");
  });
});

describe("sortOptions and flexPositions", () => {
  it("offers the stats of the selected position", () => {
    expect(sortOptions(null, 2025).map((option) => option.label)).toEqual(["2025 pts", "Name"]);
    expect(sortOptions("QB", 2025).map((option) => option.key)).toContain("passingYards");
  });

  it("is null when the league has no flex slot, and adds QB for a superflex", () => {
    const settings = (extra: Record<string, number>) =>
      ({ id: 1, seasonId: 1, rosterNumFlexWrRbTe: 0, ...extra }) as LeagueSettings;
    expect(flexPositions(settings({}))).toBeNull();
    expect(flexPositions(settings({ rosterNumFlexWrRbTe: 1 }))).toEqual(["RB", "WR", "TE"]);
    expect(flexPositions(settings({ rosterNumFlexQbWrRbTe: 1 }))).toContain("QB");
  });
});
