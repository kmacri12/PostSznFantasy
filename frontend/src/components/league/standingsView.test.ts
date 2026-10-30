import { describe, expect, it } from "vitest";
import type { StandingsRow } from "../../api/types";
import { rankLabel, tieNote } from "./standingsView";

const row = (teamId: number, rank: number, extra: Partial<StandingsRow> = {}): StandingsRow => ({
  teamId,
  rank,
  teamName: `Team ${teamId}`,
  owner: "ann",
  playersLeft: 3,
  wildCard: 0,
  divisional: 0,
  confChamp: 0,
  superBowl: 0,
  total: 0,
  tieReason: null,
  progress: { finished: 0, live: 0, toPlay: 0, notPlaying: 9 },
  ...extra,
});

const reason = {
  rule: "round_score" as const,
  round: 2,
  overTeamId: 2,
  overTeamName: "Team 2",
  aheadValue: 20,
  behindValue: 10,
  detail: "higher Divisional score (20 to 10)",
  message: "Ahead of Team 2 on the tiebreaker: higher Divisional score (20 to 10)",
};

describe("rankLabel", () => {
  it("prefixes T when teams share a rank", () => {
    const rows = [row(1, 1), row(2, 1), row(3, 3)];
    expect(rows.map((_, index) => rankLabel(rows, index))).toEqual(["T1", "T1", "3"]);
  });
});

describe("tieNote", () => {
  const rows = [row(1, 1, { tieReason: reason }), row(2, 2), row(3, 3)];

  it("gives the team ranked above the reason as written", () => {
    expect(tieNote(rows, 0)).toBe(reason.message);
  });

  it("words the same reason from the other side for the team below", () => {
    expect(tieNote(rows, 1)).toBe(
      "Behind Team 1 on the tiebreaker: higher Divisional score (20 to 10)",
    );
  });

  it("is empty where no tie decided the order", () => {
    expect(tieNote(rows, 2)).toBeNull();
  });
});
