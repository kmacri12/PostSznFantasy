import { describe, expect, it } from "vitest";
import { lineupPlayer, roundLineup, slot } from "../../test/lineup";
import {
  benchPlayersOf,
  eliminatedLastRound,
  gameOutcome,
  hurtStarters,
  hurtStartersMessage,
  playerDetail,
  playerStatus,
  rosterStatus,
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

  it("names the opponent after the time, with @ for an away game", () => {
    const kickoff = "2026-01-11T23:30:00Z";
    const home = playerDetail(lineupPlayer({ kickoff, opponentAbv: "DAL", isHome: true }));
    const away = playerDetail(lineupPlayer({ kickoff, opponentAbv: "DAL", isHome: false }));
    expect(home).toMatch(/^[A-Z][a-z]{2} \d{1,2}:\d{2} .+ vs DAL$/);
    expect(away).toMatch(/^[A-Z][a-z]{2} \d{1,2}:\d{2} .+ @ DAL$/);
  });

  it("shows the clock and live stats while the game is on", () => {
    const live = lineupPlayer({
      gameState: "live",
      gameClock: "Q3 8:42",
      statLine: "14/21, 168 yds",
    });
    expect(playerDetail(live)).toBe("Q3 8:42 · 14/21, 168 yds");
    expect(playerDetail(lineupPlayer({ gameState: "live" }))).toBe("Live · no stats yet");
  });

  it("shows the final stats, or says there were none", () => {
    expect(playerDetail(lineupPlayer({ gameState: "final", statLine: "4 rec, 41 yds" }))).toBe(
      "4 rec, 41 yds",
    );
    expect(playerDetail(lineupPlayer({ gameState: "final" }))).toBe("No stats");
  });

  it("follows a finished game's score with the stats; the result word is gameOutcome's", () => {
    const game = { gameState: "final" as const, statLine: "4 rec, 41 yds", opponentAbv: "IND" };
    const won = lineupPlayer({ ...game, isHome: true, teamScore: 27, opponentScore: 20 });
    const lost = lineupPlayer({ ...game, isHome: false, teamScore: 17, opponentScore: 24 });
    expect(playerDetail(won)).toBe("27-20 · 4 rec, 41 yds");
    expect(playerDetail(lost)).toBe("17-24 · 4 rec, 41 yds");
    expect(playerDetail(lineupPlayer(game))).toBe("4 rec, 41 yds");
  });

  it("a win advances, a loss eliminates, the Super Bowl's winner is the champion", () => {
    const final = { gameState: "final" as const };
    const won = lineupPlayer({ ...final, teamScore: 27, opponentScore: 20 });
    const lost = lineupPlayer({ ...final, teamScore: 17, opponentScore: 24 });
    expect(gameOutcome(won)).toEqual({ word: "ADVANCES", won: true, score: "27-20" });
    expect(gameOutcome(lost)).toEqual({ word: "ELIMINATED", won: false, score: "17-24" });
    expect(gameOutcome(won, true)?.word).toBe("CHAMPION");
    expect(gameOutcome(lost, true)?.word).toBe("ELIMINATED");
  });

  it("says nothing before the game ends, without a score, or once already out", () => {
    const scores = { teamScore: 27, opponentScore: 20 };
    expect(gameOutcome(lineupPlayer({ ...scores, gameState: "live" }))).toBeNull();
    expect(gameOutcome(lineupPlayer({ gameState: "final" }))).toBeNull();
    expect(
      gameOutcome(lineupPlayer({ ...scores, gameState: "final", status: "eliminated" })),
    ).toBeNull();
    expect(
      gameOutcome(lineupPlayer({ gameState: "final", teamScore: 20, opponentScore: 20 })),
    ).toBeNull();
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
    slot(2, "DST", null),
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
    const loose = lineupPlayer({ id: 9, position: "WR" });
    const bench = benchPlayersOf(roundLineup(1, { slots: starters, unassigned: [loose] }));
    expect(bench.map((player) => player.id)).toEqual([3, 9]);
  });

  it("sorts bench-slot and unplaced players together by position, then name", () => {
    const moved = [
      slot(5, "BENCH", lineupPlayer({ id: 1, name: "Kyler Murray", position: "QB" })),
      slot(6, "BENCH", lineupPlayer({ id: 2, name: "DK Metcalf", position: "WR" })),
      slot(7, "BENCH", lineupPlayer({ id: 3, name: "Kenneth Walker III", position: "RB" })),
    ];
    const unassigned = [
      lineupPlayer({ id: 4, name: "Buffalo Bills", position: "DST" }),
      lineupPlayer({ id: 5, name: "Antonio Williams", position: "WR" }),
      lineupPlayer({ id: 6, name: "Rico Dowdle", position: "RB" }),
      lineupPlayer({ id: 7, name: "Travis Kelce", position: "TE" }),
    ];
    const bench = benchPlayersOf(roundLineup(1, { slots: moved, unassigned }));
    expect(bench.map((player) => player.id)).toEqual([1, 3, 6, 5, 2, 7, 4]);
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

  it("numbers repeated slots and shortens the superflex", () => {
    const names = slotNames(
      roundLineup(1, {
        slots: [slot(0, "WR"), slot(1, "WR"), slot(2, "QB"), slot(3, "DST")],
      }),
    );
    expect([...names.values()]).toEqual(["WR1", "WR2", "QB", "DST"]);
    expect(slotLabel("SUPER_FLEX")).toBe("SFLX");
  });
});

describe("hurt starters", () => {
  const hurt = (overrides = {}) => lineupPlayer({ injuryStatus: "Out", ...overrides });

  it("lists starters who are Out, Doubtful or on IR and can still be swapped", () => {
    const lineup = roundLineup(1, {
      slots: [
        slot(0, "QB", hurt({ id: 1 })),
        slot(1, "RB", hurt({ id: 2, injuryStatus: "Doubtful" })),
        slot(2, "WR", hurt({ id: 3, injuryStatus: "Questionable" })),
        slot(3, "TE", hurt({ id: 4, locked: true })),
        slot(4, "K", hurt({ id: 5, status: "eliminated" })),
        slot(5, "BENCH", hurt({ id: 6 })),
        slot(6, "DST", lineupPlayer({ id: 7 })),
      ],
    });
    expect(hurtStarters(lineup).map((player) => player.id)).toEqual([1, 2]);
  });

  it("says who is hurt and that there is time", () => {
    expect(hurtStartersMessage([hurt({ name: "Josh Allen" })])).toBe(
      "Josh Allen is Out. Swap him out before his game starts.",
    );
    expect(
      hurtStartersMessage([hurt({ name: "A" }), hurt({ name: "B", injuryStatus: "Doubtful" })]),
    ).toBe("2 starters are hurt: A, B. Swap them out before their games start.");
  });
});

describe("playerStatus and rosterStatus", () => {
  const final = { gameState: "final" as const };
  const won = lineupPlayer({ id: 1, ...final, teamScore: 27, opponentScore: 20 });
  const lost = lineupPlayer({ id: 2, ...final, teamScore: 17, opponentScore: 24 });
  const live = lineupPlayer({ id: 3, gameState: "live" });
  const waiting = lineupPlayer({ id: 4, gameState: "scheduled" });
  const out = lineupPlayer({ id: 5, status: "eliminated", eliminatedRound: 1 });
  const bye = lineupPlayer({ id: 6, status: "bye" });

  it("a win or a bye advances, a loss or an earlier exit is out, the rest are live or to play", () => {
    expect(playerStatus(won)).toBe("advanced");
    expect(playerStatus(bye)).toBe("advanced");
    expect(playerStatus(lost)).toBe("eliminated");
    expect(playerStatus(out)).toBe("eliminated");
    expect(playerStatus(live)).toBe("live");
    expect(playerStatus(waiting)).toBe("toPlay");
    expect(playerStatus(lineupPlayer({ gameState: "final" }))).toBe("toPlay");
  });

  it("nobody is eliminated from the Super Bowl: both finalists' players stay advanced", () => {
    expect(playerStatus(won, 4)).toBe("advanced");
    expect(playerStatus(lost, 4)).toBe("advanced");
    expect(playerStatus(out, 4)).toBe("eliminated"); // out before it
  });

  const lineup = (round: number, firstKickoff: string | null) =>
    roundLineup(round, {
      firstKickoff,
      slots: [slot(0, "QB", won), slot(1, "RB", live), slot(2, "WR", null)],
      unassigned: [waiting, bye],
      eliminated: [lost, out],
    });

  it("counts the whole roster, in green, blue, grey, red order", () => {
    const status = rosterStatus(
      [lineup(1, "2027-01-09T18:00:00Z")],
      new Date("2027-01-10T12:00:00Z"),
    );
    expect(status?.counts).toEqual({ advanced: 2, live: 1, toPlay: 1, eliminated: 2 });
    expect(status?.statuses).toEqual([
      "advanced",
      "advanced",
      "live",
      "toPlay",
      "eliminated",
      "eliminated",
    ]);
    expect(status?.left).toBe(4);
  });

  it("describes the latest round that has kicked off, until the next one's first kickoff", () => {
    const lineups = [lineup(1, "2027-01-09T18:00:00Z"), lineup(2, "2027-01-16T18:00:00Z")];
    expect(rosterStatus(lineups, new Date("2027-01-13T12:00:00Z"))?.round).toBe(1);
    expect(rosterStatus(lineups, new Date("2027-01-16T19:00:00Z"))?.round).toBe(2);
    // The standings' round wins: Thursday morning's switch, not the kickoff.
    expect(rosterStatus(lineups, new Date("2027-01-13T12:00:00Z"), 2)?.round).toBe(2);
    expect(rosterStatus(lineups, new Date("2027-01-16T19:00:00Z"), 1)?.round).toBe(1);
    expect(rosterStatus(lineups, new Date("2027-01-01T12:00:00Z"))?.round).toBe(1);
  });

  it("is null for an empty roster", () => {
    expect(rosterStatus([roundLineup(1)], new Date())).toBeNull();
    expect(rosterStatus([], new Date())).toBeNull();
  });
});
