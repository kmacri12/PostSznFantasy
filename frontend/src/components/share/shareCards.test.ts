import { describe, expect, it } from "vitest";
import type { DraftState, SeasonRecap, Standings, StandingsRow } from "../../api/types";
import { championCard, draftCard, draftGridShape, roundCard, roundIsComplete } from "./shareCards";

const row = (id: number, name: string, wildCard: number, extra: Partial<StandingsRow> = {}) =>
  ({
    teamId: id,
    rank: id,
    teamName: name,
    owner: `Owner ${id}`,
    isCommissioner: false,
    playersLeft: 3,
    wildCard,
    divisional: 0,
    confChamp: 0,
    superBowl: 0,
    total: wildCard,
    tieReason: null,
    progress: { finished: 5, live: 0, toPlay: 0, notPlaying: 0 },
    ...extra,
  }) as unknown as StandingsRow;

const standings = (teams: StandingsRow[], extra: Partial<Standings> = {}): Standings => ({
  phase: "live",
  round: 1,
  gamesInProgress: 0,
  gamesFinal: 6,
  playersLeft: 10,
  teams,
  ...extra,
});

const recap = {
  seasonId: 1,
  leagueId: 1,
  year: 2026,
  finished: true,
  champions: [{ teamId: 1, teamName: "Gridiron Gang", owner: "Pat", total: 210.5 }],
  standings: standings([
    row(1, "Gridiron Gang", 210.5),
    row(2, "B", 190),
    row(3, "C", 150),
    row(4, "D", 1),
  ]),
  nextSeasonId: null,
  awards: [],
} as SeasonRecap;

describe("championCard", () => {
  it("names the champion and lists the top three", () => {
    const card = championCard("Sunday League", recap);
    expect(card?.headline).toBe("Gridiron Gang");
    expect(card?.eyebrow).toBe("2026 champion");
    expect(card?.rows.map((r) => r.label)).toEqual(["Gridiron Gang", "B", "C"]);
    expect(card?.fileName).toBe("sunday-league-2026-champion.png");
  });
  it("says co-champions for a tie and has no card without one", () => {
    const tied = {
      ...recap,
      champions: [...recap.champions, { teamId: 2, teamName: "B", owner: "Sam", total: 210.5 }],
    };
    expect(championCard("L", tied)?.eyebrow).toBe("2026 co-champions");
    expect(championCard("L", { ...recap, champions: [] })).toBeNull();
  });
  it("carries display names only, never an address", () => {
    expect(JSON.stringify(championCard("L", recap))).not.toContain("@");
  });
});

describe("roundCard", () => {
  const teams = [row(1, "A", 40), row(2, "B", 55), row(3, "C", 55), row(4, "D", 10)];
  it("ranks the round's scores, ties sharing a place", () => {
    const card = roundCard("L", 2026, standings(teams));
    expect(card?.eyebrow).toBe("2026 Wild Card round");
    expect(card?.rows.map((r) => r.rank)).toEqual([1, 1, 3]);
  });
  it("waits for the round to be over", () => {
    expect(roundIsComplete(standings(teams, { gamesInProgress: 1 }))).toBe(false);
    expect(roundIsComplete(standings(teams, { gamesFinal: 0 }))).toBe(false);
    expect(roundIsComplete(standings(teams, { phase: "pre_draft" }))).toBe(false);
    const toPlay = [
      row(1, "A", 1, { progress: { finished: 1, live: 0, toPlay: 2, notPlaying: 0 } }),
    ];
    expect(roundCard("L", 2026, standings(toPlay))).toBeNull();
  });
});

describe("draftCard", () => {
  const draft = {
    status: "completed",
    rounds: 2,
    order: [
      { slot: 1, teamId: 1, teamName: "A" },
      { slot: 2, teamId: 2, teamName: "B" },
    ],
    picks: [
      { teamId: 2, playerName: "Two", position: "RB", numberPickOverall: 2 },
      { teamId: 1, playerName: "One", position: "QB", numberPickOverall: 1 },
      { teamId: 1, playerName: "Four", position: "K", numberPickOverall: 4 },
    ],
  } as unknown as DraftState;
  it("gives each team its picks in order", () => {
    const card = draftCard("L", 2026, draft);
    expect(card?.columns[0]?.lines.map((l) => l.text)).toEqual(["One", "Four"]);
    expect(card?.columns[1]?.lines.map((l) => l.text)).toEqual(["Two"]);
  });
  it("has no card until the draft is complete", () => {
    expect(draftCard("L", 2026, { ...draft, status: "in_progress" })).toBeNull();
  });
  it("shapes the grid by team count", () => {
    expect(draftGridShape(6)).toEqual({ cols: 3, rows: 2 });
    expect(draftGridShape(12)).toEqual({ cols: 4, rows: 3 });
  });
});
