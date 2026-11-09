import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DraftState } from "../../api/types";
import DraftBoard from "./DraftBoard";

const base: DraftState = {
  draftId: 1,
  seasonId: 1,
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
    { slot: 1, teamId: 10, teamName: "Alpha", ownerName: "ann", ownerUserId: 1 },
    { slot: 2, teamId: 20, teamName: "Bravo", ownerName: null, ownerUserId: null },
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
  reservedPicks: [],
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
    expect(screen.getByTestId("pick-1").textContent).toContain("P. QB");
    expect(screen.getByTestId("pick-2").textContent).toContain("On the clock");
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

describe("DraftBoard team QB / team K", () => {
  const withFlag = (scoresWholeTeam: boolean): DraftState => ({
    ...base,
    picks: base.picks.map((pick) => ({ ...pick, teamAbv: "PHI", scoresWholeTeam })),
  });

  it("badges a drafted team QB while still showing his name", () => {
    render(<DraftBoard state={withFlag(true)} myTeamId={null} />);
    expect(screen.getByText("P. QB")).toBeTruthy();
    expect(screen.getByRole("note", { name: /Scores all PHI QBs/ })).toBeTruthy();
  });

  it("shows no badge for an ordinary pick", () => {
    render(<DraftBoard state={withFlag(false)} myTeamId={null} />);
    expect(screen.queryByRole("note")).toBeNull();
  });

  it("shows a reserved player and lets a commissioner tap a slot", () => {
    const onSelectSlot = vi.fn();
    render(
      <DraftBoard
        state={{
          ...base,
          reservedPicks: [
            {
              pickNumber: 3,
              teamId: 20,
              playerId: 9,
              playerName: "Tyreek Hill",
              position: "WR",
              teamAbv: "MIA",
            },
          ],
        }}
        myTeamId={10}
        onSelectSlot={onSelectSlot}
      />,
    );
    expect(screen.getByText("T. Hill")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Assign pick 3" }));
    expect(onSelectSlot).toHaveBeenCalledWith({ pickNumber: 3, teamName: "Bravo" });
  });
});
