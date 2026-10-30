import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { DraftState } from "../../api/types";
import DraftBoard from "./DraftBoard";

const base: DraftState = {
  draftId: 1,
  leagueId: 1,
  status: "in_progress",
  startTime: null,
  draftType: "snake",
  rounds: 2,
  timePerPickSeconds: 60,
  pickTimeoutAction: "best_available",
  pickStartedAt: null,
  currentPickDeadline: null,
  pausedRemainingSeconds: null,
  serverTime: "2030-01-01T00:00:00Z",
  orderLocked: true,
  order: [
    { slot: 1, teamId: 10, teamName: "Alpha", ownerName: "ann" },
    { slot: 2, teamId: 20, teamName: "Bravo", ownerName: null },
  ],
  unassignedTeamIds: [],
  picks: [
    {
      id: 1,
      draftId: 1,
      teamId: 10,
      playerId: 5,
      playerName: "Pat QB",
      position: "QB",
      numberRound: 1,
      numberPickOverall: 1,
      numberPickInRound: 1,
      autopick: false,
    },
  ],
  totalPicks: 4,
  currentPickOverall: 2,
  onTheClockTeamId: 20,
  onDeckTeamId: 20,
  positionCaps: {},
  draftCutoff: null,
  playoffFieldSet: true,
};

describe("DraftBoard", () => {
  it("renders teams as columns in assigned order with picks in their cells", () => {
    render(<DraftBoard state={base} myTeamId={10} />);
    expect(screen.getAllByText(/Alpha|Bravo/).map((node) => node.textContent)).toEqual([
      "Alpha",
      "Bravo",
    ]);
    expect(screen.getByTestId("pick-1").textContent).toContain("Pat QB");
    expect(screen.getByTestId("pick-2").textContent).toBe("#2");
  });

  it("reverses odd rounds for snake drafts", () => {
    render(<DraftBoard state={base} myTeamId={null} />);
    const cells = screen.getAllByTestId(/pick-/).map((node) => node.dataset.testid);
    // Row 1: picks 1, 2. Row 2 (reversed): Bravo gets pick 3, Alpha gets pick 4.
    expect(cells).toEqual(["pick-1", "pick-2", "pick-4", "pick-3"]);
  });

  it("explains when the order has not been set", () => {
    render(<DraftBoard state={{ ...base, order: [] }} myTeamId={null} />);
    expect(screen.getByText(/hasn't set the draft order/i)).toBeTruthy();
  });

  it("labels auto-picks on the board", () => {
    const picks = [{ ...base.picks[0], autopick: true }] as DraftState["picks"];
    render(<DraftBoard state={{ ...base, picks }} myTeamId={10} />);
    expect(screen.getByTestId("pick-1").textContent).toContain("auto");
  });
});
