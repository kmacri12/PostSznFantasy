import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DraftState } from "../../api/types";
import { SeasonContext } from "../../contexts/SeasonContext";
import { testSeason } from "../../test/season";
import CommissionerStrip from "./CommissionerStrip";

const mutate = vi.fn();
const motion = vi.hoisted(() => ({ reduced: false }));
vi.mock("../../hooks/useReducedMotion", () => ({ useReducedMotion: () => motion.reduced }));
vi.mock("../../api/queries", () => ({
  useDraftControl: () => ({ mutate, isPending: false, error: null }),
  useDraftSetup: () => ({ mutate: vi.fn(), isPending: false, error: null }),
}));

const draft = (overrides: Partial<DraftState> = {}): DraftState =>
  ({
    seasonId: 1,
    status: "in_progress",
    rounds: 2,
    draftType: "snake",
    timePerPickSeconds: 90,
    orderLocked: true,
    unassignedTeamIds: [],
    onTheClockTeamId: 2,
    order: [
      { slot: 1, teamId: 1, teamName: "Alpha", ownerName: "ann", ownerUserId: 11 },
      { slot: 2, teamId: 2, teamName: "Bravo", ownerName: null, ownerUserId: null },
    ],
    picks: [
      {
        id: 1,
        teamId: 1,
        playerId: 5,
        playerName: "Jalen Hurts",
        numberPickOverall: 1,
      },
    ],
    reservedPicks: [],
    ...overrides,
  }) as DraftState;

const strip = (state: DraftState) =>
  render(
    <MemoryRouter>
      <SeasonContext.Provider value={testSeason({}, true)}>
        <CommissionerStrip draft={state} presence={[]} editingOrder={false} onEditOrder={vi.fn()} />
      </SeasonContext.Provider>
    </MemoryRouter>,
  );

describe("CommissionerStrip confirmations", () => {
  beforeEach(() => mutate.mockClear());

  it("is open during a live draft, and Undo names the pick before it runs", () => {
    strip(draft());
    fireEvent.click(screen.getByRole("button", { name: "Undo last pick" }));
    expect(mutate).not.toHaveBeenCalled();
    expect(screen.getByText(/Pick 1: Alpha took Jalen Hurts/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Undo pick" }));
    expect(mutate).toHaveBeenCalledWith("undo", expect.anything());
  });

  it("names the team that loses its turn on Auto-pick now", () => {
    strip(draft());
    fireEvent.click(screen.getByRole("button", { name: "Auto-pick now" }));
    expect(screen.getByText(/Bravo loses its turn/)).toBeInTheDocument();
    expect(mutate).not.toHaveBeenCalled();
  });

  it("shows the preflight before Start and disables it while the order is incomplete", () => {
    strip(draft({ status: "lobby", orderLocked: false, picks: [], unassignedTeamIds: [3] }));
    fireEvent.click(screen.getByRole("button", { name: "Start draft" }));
    expect(screen.getByText(/1 of 3 teams have an owner/)).toBeInTheDocument();
    const confirm = screen.getAllByRole("button", { name: "Start draft" }).at(-1);
    expect(confirm).toBeDisabled();
    expect(mutate).not.toHaveBeenCalled();
  });

  it("reveals the shuffled order after Randomize, unless motion is reduced", () => {
    const shuffled = [
      { slot: 1, teamId: 2, teamName: "Bravo", ownerName: null, ownerUserId: null },
    ];
    const two = [
      ...shuffled,
      { slot: 2, teamId: 1, teamName: "Alpha", ownerName: null, ownerUserId: null },
    ];
    mutate.mockImplementation((_action, options) => options?.onSuccess?.({ order: two }));
    const state = draft({ status: "lobby", orderLocked: false, picks: [] });
    const { unmount } = strip(state);
    fireEvent.click(screen.getByRole("button", { name: "Randomize draft order" }));
    expect(screen.getByText("The draft order")).toBeInTheDocument();
    unmount();

    motion.reduced = true;
    strip(state);
    fireEvent.click(screen.getByRole("button", { name: "Randomize draft order" }));
    expect(screen.queryByText("The draft order")).not.toBeInTheDocument();
    motion.reduced = false;
    mutate.mockReset();
  });
});
