import { describe, expect, it } from "vitest";
import { lineupPlayer, roundLineup, slot } from "../../test/lineup";
import {
  benchPlayersOf,
  eliminatedLastRound,
  playerDetail,
  roundIsFinal,
  roundScore,
  rowState,
  slotLabel,
  slotNames,
} from "./lineupView";

describe("what a row says", () => {
  it("shows the game's day and time before it starts, never the word kickoff", () => {
    const text = playerDetail(lineupPlayer({ kickoff: "2026-01-11T23:30:00Z" }));
    expect(text).toMatch(/^[A-Z][a-z]{2} \d{1,2}:\d{2}/);
    expect(text.toLowerCase()).not.toContain("kickoff");
    expect(playerDetail(lineupPlayer())).toBe("Game not scheduled yet");
  });

  it("shows the clock and live stats while the game is on", () => {
    const live = lineupPlayer({ gameState: "live", gameClock: "8:42", statLine: "14/21, 168 yds" });
    expect(playerDetail(live)).toBe("Live 8:42 · 14/21, 168 yds");
    expect(playerDetail(lineupPlayer({ gameState: "live" }))).toBe("Live · no stats yet");
  });

  it("shows the final stats, or says there were none", () => {
    expect(playerDetail(lineupPlayer({ gameState: "final", statLine: "4 rec, 41 yds" }))).toBe(
      "4 rec, 41 yds",
    );
    expect(playerDetail(lineupPlayer({ gameState: "final" }))).toBe("No stats");
  });

  it("names the round an eliminated player's team went out in", () => {
    const out = lineupPlayer({ status: "eliminated", eliminatedRound: 2 });
    expect(playerDetail(out)).toBe("Eliminated in Divisional");
  });

  it("colours by game: white until it starts, green while on, grey when done", () => {
    expect(rowState(lineupPlayer())).toBe("ready");
    expect(rowState(lineupPlayer({ gameState: "scheduled" }))).toBe("ready");
    expect(rowState(lineupPlayer({ gameState: "live" }))).toBe("live");
    expect(rowState(lineupPlayer({ gameState: "final" }))).toBe("done");
    expect(rowState(lineupPlayer({ status: "eliminated" }))).toBe("eliminated");
  });
});

describe("a round's lineup", () => {
  const starters = [
    slot(0, "QB", lineupPlayer({ id: 1, points: 17.4, gameState: "live" })),
    slot(1, "WR", lineupPlayer({ id: 2, points: 3.1, gameState: "final" })),
    slot(2, "DEF", null),
    slot(3, "BENCH", lineupPlayer({ id: 3, position: "WR", points: 5 })),
    slot(4, "BENCH", null),
  ];

  it("scores a round as the sum of its starters", () => {
    expect(roundScore(roundLineup(1, { slots: starters }))).toBe(20.5);
  });

  it("has no score while no starter has any stats", () => {
    expect(roundScore(roundLineup(2, { slots: [slot(0, "QB", lineupPlayer())] }))).toBeNull();
  });

  it("is final once every starter with a game has finished it", () => {
    expect(roundIsFinal(roundLineup(1, { slots: starters }))).toBe(false);
    const done = [slot(0, "QB", lineupPlayer({ gameState: "final" })), slot(1, "WR", null)];
    expect(roundIsFinal(roundLineup(1, { slots: done }))).toBe(true);
    expect(roundIsFinal(roundLineup(1, { slots: [slot(0, "QB", lineupPlayer())] }))).toBe(false);
  });

  it("puts placed bench players and unplaced players on the bench", () => {
    const loose = lineupPlayer({ id: 9 });
    const bench = benchPlayersOf(roundLineup(1, { slots: starters, unassigned: [loose] }));
    expect(bench.map((player) => player.id)).toEqual([3, 9]);
  });

  it("lists only players whose team went out last round", () => {
    const lineup = roundLineup(3, {
      eliminated: [
        lineupPlayer({ id: 1, status: "eliminated", eliminatedRound: 2 }),
        lineupPlayer({ id: 2, status: "eliminated", eliminatedRound: 1 }),
      ],
    });
    expect(eliminatedLastRound(lineup).map((player) => player.id)).toEqual([1]);
  });

  it("numbers repeated slots and labels the defense DST", () => {
    const names = slotNames(
      roundLineup(1, {
        slots: [slot(0, "WR"), slot(1, "WR"), slot(2, "QB"), slot(3, "DEF")],
      }),
    );
    expect([...names.values()]).toEqual(["WR1", "WR2", "QB", "DST"]);
    expect(slotLabel("DEF")).toBe("DST");
  });
});
