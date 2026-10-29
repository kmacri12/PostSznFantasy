import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { RosterSlot } from "../../api/types";
import LineupList from "./LineupList";

const slots: RosterSlot[] = [
  {
    index: 0,
    slot: "QB",
    player: {
      id: 1,
      name: "Josh Allen",
      position: "QB",
      teamAbv: "BUF",
      slot: "QB",
      isActive: true,
      nextGame: { opponentAbv: "KC", gameTimeEpoch: null, status: null },
    },
  },
  { index: 1, slot: "RB", player: null },
  {
    index: 2,
    slot: "BENCH",
    player: {
      id: 2,
      name: "Derrick Henry",
      position: "RB",
      teamAbv: "BAL",
      slot: "BENCH",
      isActive: false,
      nextGame: null,
    },
  },
];

describe("LineupList", () => {
  it("shows every slot, including empty ones, grouped as starters and bench", () => {
    render(<LineupList slots={slots} canDrag onMove={() => {}} />);
    expect(screen.getByText("Starters")).toBeTruthy();
    expect(screen.getByText("Bench")).toBeTruthy();
    expect(screen.getByTestId("slot-0").textContent).toContain("Josh Allen");
    expect(screen.getByTestId("slot-1").textContent).toContain("Empty");
    expect(screen.getByTestId("slot-2").textContent).toContain("Derrick Henry");
    expect(screen.getAllByLabelText("Eliminated")).toHaveLength(1);
  });

  it("only offers the drag hint to the owner", () => {
    const { rerender } = render(<LineupList slots={slots} canDrag onMove={() => {}} />);
    expect(screen.getByText(/touch and hold/i)).toBeTruthy();
    rerender(<LineupList slots={slots} canDrag={false} onMove={() => {}} />);
    expect(screen.queryByText(/touch and hold/i)).toBeNull();
  });
});
