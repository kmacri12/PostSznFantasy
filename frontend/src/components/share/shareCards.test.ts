import { describe, expect, it } from "vitest";
import type { DraftState, SeasonRecap, Standings, StandingsRow } from "../../api/types";
import { cardSize, championCard, draftCard, recapCard } from "./shareCards";

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
  gamesToPlay: 0,
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
  it("sizes the board by teams and rounds", () => {
    const card = draftCard("L", 2026, draft);
    const small = card ? cardSize(card) : null;
    expect(small?.width).toBeLessThan(
      cardSize({
        ...(card as NonNullable<typeof card>),
        columns: [...(card?.columns ?? []), ...(card?.columns ?? [])],
      }).width,
    );
  });
});

describe("recapCard", () => {
  const highlights = [
    { kind: "top_team", text: "Kmac led the week.", teamId: 1, stat: "40" },
    { kind: "top_bench", text: "Josh Allen scored 28 on Team 2's bench.", teamId: 2 },
  ];

  it("lists every highlight under its label, in the portrait size", () => {
    const card = recapCard("Fake League", 2026, 1, highlights);
    expect(card).toMatchObject({
      kind: "recap",
      eyebrow: "Wild Card recap",
      headline: "Fake League",
      fileName: "fake-league-2026-wild-card-recap.png",
      highlights: [
        {
          label: "Team of the week",
          text: "Kmac led the week.",
          emoji: "🏆",
          tone: "gold",
          stat: "40",
        },
        {
          label: "Put me in, coach!",
          text: "Josh Allen scored 28 on Team 2's bench.",
          emoji: "🪑",
          tone: "warning",
          stat: null,
        },
      ],
    });
    expect(card && cardSize(card)).toEqual({ width: 1080, height: 1350 });
  });

  it("lists every team's points, ties sharing a place, and grows taller with the teams", () => {
    const scores = [
      { teamId: 1, teamName: "Kmac", points: 112.3 },
      { teamId: 2, teamName: "Team 2", points: 50 },
      { teamId: 3, teamName: "Team 3", points: 50 },
      { teamId: 4, teamName: "Team 4", points: 12.4 },
    ];
    const card = recapCard("Fake League", 2026, 2, highlights, scores);
    expect(card?.scores).toEqual([
      { rank: 1, label: "Kmac", value: "112.3" },
      { rank: 2, label: "Team 2", value: "50.0" },
      { rank: 2, label: "Team 3", value: "50.0" },
      { rank: 4, label: "Team 4", value: "12.4" },
    ]);
    const many = Array.from({ length: 10 }, (_, i) => ({
      teamId: i,
      teamName: `Team ${i}`,
      points: i,
    }));
    const tall = recapCard("L", 2026, 2, [...highlights, ...highlights, ...highlights], many);
    expect(tall && cardSize(tall).height).toBeGreaterThan(1350);
  });

  it("makes no card when there is nothing to say", () => {
    expect(recapCard("Fake League", 2026, 1, [])).toBeNull();
  });
});
