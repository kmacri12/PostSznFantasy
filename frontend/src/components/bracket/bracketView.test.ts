import { describe, expect, it } from "vitest";
import type { BracketGame, BracketTeam } from "../../api/types";
import { gameStatusText, matchupTitle, myPlayersSummary, winnerId } from "./bracketView";

const team = (id: number, abbreviation: string): BracketTeam => ({
  id,
  abbreviation,
  city: abbreviation,
  name: abbreviation,
  logoUrl: null,
  topPlayers: [],
});

const game = (patch: Partial<BracketGame> = {}): BracketGame => ({
  id: "g",
  kickoff: null,
  state: "scheduled",
  clock: null,
  home: team(1, "KC"),
  away: team(2, "BUF"),
  homePoints: null,
  awayPoints: null,
  winnerTeamId: null,
  myPlayers: [],
  ...patch,
});

describe("matchupTitle", () => {
  it("names the away team first and falls back to TBD", () => {
    expect(matchupTitle(game())).toBe("BUF at KC");
    expect(matchupTitle(game({ away: null }))).toBe("TBD at KC");
  });
});

describe("gameStatusText", () => {
  it("says Final, Live with the clock, or that the time is not set", () => {
    expect(gameStatusText(game({ state: "final" }))).toBe("Final");
    expect(gameStatusText(game({ state: "live", clock: "4:12 Q3" }))).toBe("Live · 4:12 Q3");
    expect(gameStatusText(game({ state: "live" }))).toBe("Live");
    expect(gameStatusText(game())).toBe("Time to be set");
  });

  it("shows the kickoff with a time zone for a scheduled game", () => {
    expect(gameStatusText(game({ kickoff: "2026-01-10T21:30:00Z" }))).toMatch(/\d.*[A-Z]{2,}/);
  });
});

describe("myPlayersSummary", () => {
  const mine = (role: "starter" | "bench", id: number) => ({
    id,
    name: "P",
    position: "WR",
    teamId: 1,
    role,
  });

  it("counts starters and bench, and is null with no players", () => {
    expect(myPlayersSummary(game())).toBeNull();
    expect(
      myPlayersSummary(
        game({ myPlayers: [mine("starter", 1), mine("starter", 2), mine("bench", 3)] }),
      ),
    ).toBe("2 starters, 1 bench");
    expect(myPlayersSummary(game({ myPlayers: [mine("starter", 1)] }))).toBe("1 starter");
  });
});

describe("winnerId", () => {
  it("is set only once the game is final", () => {
    expect(winnerId(game({ winnerTeamId: 1 }))).toBeNull();
    expect(winnerId(game({ state: "final", winnerTeamId: 1 }))).toBe(1);
  });
});
