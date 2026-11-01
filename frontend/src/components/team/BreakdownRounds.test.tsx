import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { BreakdownPlayer, BreakdownRound, TeamBreakdown } from "../../api/types";
import BreakdownRounds, { openRound } from "./BreakdownRounds";

const player = (id: number, name: string, slot: string | null, value: number): BreakdownPlayer => ({
  playerId: id,
  name,
  position: "RB",
  teamAbv: "KC",
  slot,
  points: value,
  scoreChange: null,
});

const round = (number: number, extra: Partial<BreakdownRound> = {}): BreakdownRound => ({
  round: number,
  multiplier: 1,
  counted: 0,
  starters: [],
  bench: [],
  benchPoints: 0,
  ...extra,
});

const breakdown: TeamBreakdown = {
  teamId: 1,
  seasonId: 9,
  teamName: "Alpha",
  total: 18,
  pointsLeftOnBench: 55,
  rounds: [
    round(1, {
      counted: 10,
      benchPoints: 35,
      starters: [
        { index: 0, slot: "QB", player: null, points: 0, mark: null },
        {
          index: 1,
          slot: "RB",
          player: player(1, "Sam Starter", "RB", 10),
          points: 10,
          mark: null,
        },
      ],
      bench: [player(2, "Bea Bench", "BENCH", 30), player(3, "Una Placed", null, 5)],
    }),
    round(2, {
      multiplier: 2,
      counted: 8,
      benchPoints: 20,
      bench: [player(1, "Sam Starter", "BENCH", 20)],
    }),
    round(3),
    round(4),
  ],
};

describe("BreakdownRounds", () => {
  it("shows the team total and the points left on the bench", () => {
    render(<BreakdownRounds breakdown={breakdown} />);
    const totals = within(screen.getByRole("group", { name: "Totals" }));
    expect(totals.getByText("Total points").nextSibling?.textContent).toBe("18");
    expect(totals.getByText("Left on the bench").nextSibling?.textContent).toBe("55");
  });

  it("lists every starter slot with counted points, empty ones included", () => {
    render(<BreakdownRounds breakdown={breakdown} />);
    // Sam starts in the Wild Card and sits in the Divisional, so he is listed twice.
    expect(screen.getAllByText("Sam Starter")).toHaveLength(2);
    expect(screen.getByText("Empty")).toBeTruthy();
  });

  it("labels bench points in words and marks the multiplier", () => {
    render(<BreakdownRounds breakdown={breakdown} />);
    const divisional = screen.getByRole("button", { name: /Divisional/ });
    expect(divisional.textContent).toContain("2x");
    expect(divisional.textContent).toContain("8 pts");
    expect(screen.getByText(/20 left on the bench/)).toBeTruthy();
    const bench = within(screen.getByRole("list", { name: "Bench points" }));
    expect(bench.getByText("Bench")).toBeTruthy();
  });

  it("opens the latest round that has points", () => {
    expect(openRound(breakdown.rounds)).toBe(2);
    expect(openRound([round(1), round(2)])).toBe(1);
  });

  it("shows the override banner, emptied slot and asterisk on the breakdown too", () => {
    const marked: TeamBreakdown = {
      ...breakdown,
      rounds: [
        round(1, {
          starters: [
            {
              index: 0,
              slot: "QB",
              player: null,
              points: 0,
              mark: { kind: "override", actorName: "kyle", at: "2030-01-11T19:00:00Z" },
            },
            {
              index: 1,
              slot: "RB",
              player: player(1, "Sam Starter", "RB", 10),
              points: 10,
              mark: { kind: "commissioner_set", actorName: "kyle", at: "2030-01-11T19:00:00Z" },
            },
          ],
        }),
        round(2),
        round(3),
        round(4),
      ],
    };
    render(<BreakdownRounds breakdown={marked} />);
    expect(screen.getByTestId("override-mark").textContent).toContain(
      "Emptied by commissioner after kickoff",
    );
    expect(screen.getByTestId("commissioner-set-mark").textContent).toMatch(/^\* Set by kyle/);
  });

  it("explains a changed score with the counted before and after", () => {
    const changed: TeamBreakdown = {
      ...breakdown,
      rounds: [
        round(1, {
          bench: [
            {
              ...player(2, "Bea Bench", "BENCH", 24),
              scoreChange: { previousPoints: 20, newPoints: 24, changedAt: "2030-01-12T09:00:00Z" },
            },
          ],
        }),
        round(2),
        round(3),
        round(4),
      ],
    };
    render(<BreakdownRounds breakdown={changed} />);
    const score = screen.getByRole("button", { name: /score changed/ });
    expect(score.getAttribute("aria-label")).toContain("Was 20 pts, now 24 pts");
  });
});
