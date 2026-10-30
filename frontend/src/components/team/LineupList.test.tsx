import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { LineupPlayer, RoundLineup } from "../../api/types";
import LineupList from "./LineupList";

const player = (id: number, name: string, overrides: Partial<LineupPlayer> = {}): LineupPlayer => ({
  id,
  name,
  position: "RB",
  teamAbv: "KC",
  isActive: true,
  nextGame: null,
  status: "alive",
  kickoff: "2030-01-11T18:00:00Z",
  locked: false,
  ...overrides,
});

const lineup: RoundLineup = {
  round: 1,
  emptyStarterSlots: 1,
  firstKickoff: "2030-01-11T18:00:00Z",
  slots: [
    { index: 0, slot: "QB", player: player(1, "Josh Allen", { position: "QB" }) },
    { index: 1, slot: "RB", player: null },
    { index: 2, slot: "BENCH", player: player(2, "Locked Larry", { locked: true }) },
  ],
  unassigned: [player(3, "Free Fred")],
  eliminated: [player(4, "Derrick Henry", { status: "eliminated", kickoff: null })],
};

const rowOf = (name: string) => screen.getByText(name).closest("[aria-pressed], [aria-disabled]");

describe("LineupList", () => {
  it("shows starters, bench, unplaced players and a separate Eliminated section", () => {
    render(<LineupList lineup={lineup} canEdit onMove={() => {}} />);
    expect(screen.getByText("Starters")).toBeTruthy();
    expect(screen.getByText("Bench")).toBeTruthy();
    expect(screen.getByTestId("slot-1").textContent).toContain("Empty");
    expect(screen.getByTestId("slot-0").textContent).toContain("Josh Allen");
    const eliminated = screen.getByTestId("eliminated-section");
    expect(eliminated.textContent).toContain("Derrick Henry");
    expect(eliminated.textContent).toContain("Eliminated");
  });

  it("marks locked players and explains the lock", () => {
    render(<LineupList lineup={lineup} canEdit onMove={() => {}} />);
    expect(screen.getAllByLabelText("Locked")).toHaveLength(1);
    expect(screen.getAllByText(/Locks at kickoff/).length).toBeGreaterThan(0);
  });

  it("moves a player by tapping them and then a slot", () => {
    const onMove = vi.fn();
    render(<LineupList lineup={lineup} canEdit onMove={onMove} />);
    fireEvent.click(rowOf("Free Fred") as Element);
    expect(screen.getByText(/Tap a slot to move Free Fred/)).toBeTruthy();
    fireEvent.click(screen.getByTestId("slot-1").firstElementChild as Element);
    expect(onMove).toHaveBeenCalledWith({ playerId: 3, slotIndex: 1 });
  });

  it("refuses to move onto a locked player", () => {
    const onMove = vi.fn();
    render(<LineupList lineup={lineup} canEdit onMove={onMove} />);
    fireEvent.click(rowOf("Free Fred") as Element);
    fireEvent.click(screen.getByTestId("slot-2").firstElementChild as Element);
    expect(onMove).not.toHaveBeenCalled();
  });

  it("will not pick up a locked or eliminated player", () => {
    render(<LineupList lineup={lineup} canEdit onMove={() => {}} />);
    fireEvent.click(rowOf("Locked Larry") as Element);
    fireEvent.click(rowOf("Derrick Henry") as Element);
    expect(screen.queryByText(/Tap a slot to move/)).toBeNull();
  });

  it("takes a placed player out of the lineup", () => {
    const onMove = vi.fn();
    render(<LineupList lineup={lineup} canEdit onMove={onMove} />);
    fireEvent.click(rowOf("Josh Allen") as Element);
    fireEvent.click(screen.getByRole("button", { name: "Remove from lineup" }));
    expect(onMove).toHaveBeenCalledWith({ playerId: 1, slotIndex: null });
  });

  it("is read-only for anyone but the owner", () => {
    const onMove = vi.fn();
    render(<LineupList lineup={lineup} canEdit={false} onMove={onMove} />);
    fireEvent.click(screen.getByTestId("slot-0").firstElementChild as Element);
    expect(screen.queryByText(/Tap a slot to move/)).toBeNull();
    expect(screen.queryByText(/touch and hold/i)).toBeNull();
  });
});
