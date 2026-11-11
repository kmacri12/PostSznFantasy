import { describe, expect, it } from "vitest";
import type { Standings, StandingsRow } from "../../api/types";
import { roundWon } from "./roundWin";

const row = (teamId: number, wildCard: number, left = 0): StandingsRow => ({
  teamId,
  rank: teamId,
  teamName: `Team ${teamId}`,
  owner: `Owner ${teamId}`,
  isCommissioner: false,
  playersLeft: 3,
  wildCard,
  divisional: 0,
  confChamp: 0,
  superBowl: 0,
  total: wildCard,
  tieReason: null,
  progress: { finished: 5, live: 0, toPlay: left, notPlaying: 0 },
});

const standings = (teams: StandingsRow[], over: Partial<Standings> = {}): Standings => ({
  phase: "live",
  round: 1,
  gamesInProgress: 0,
  gamesFinal: 6,
  playersLeft: 9,
  teams,
  ...over,
});

describe("roundWon", () => {
  it("returns the round when my team is alone on top and nothing is left to play", () => {
    expect(roundWon(standings([row(1, 40), row(2, 30)]), 1)).toBe(1);
  });

  it("is null for the runner-up", () => {
    expect(roundWon(standings([row(1, 40), row(2, 30)]), 2)).toBeNull();
  });

  it("is null for a tie at the top", () => {
    expect(roundWon(standings([row(1, 40), row(2, 40)]), 1)).toBeNull();
  });

  it("waits while a game is live or a starter has yet to play", () => {
    expect(roundWon(standings([row(1, 40), row(2, 30)], { gamesInProgress: 1 }), 1)).toBeNull();
    expect(roundWon(standings([row(1, 40), row(2, 30, 1)]), 1)).toBeNull();
    expect(roundWon(standings([row(1, 40), row(2, 30)], { gamesFinal: 0 }), 1)).toBeNull();
  });

  it("is null before the draft, without a team, or with no points", () => {
    expect(roundWon(standings([row(1, 40)], { phase: "pre_draft" }), 1)).toBeNull();
    expect(roundWon(standings([row(1, 40)]), null)).toBeNull();
    expect(roundWon(standings([row(1, 0), row(2, 0)]), 1)).toBeNull();
  });
});
