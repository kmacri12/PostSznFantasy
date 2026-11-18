import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DraftState, PlayerSummary } from "../../api/types";
import AssignPickDialog from "./AssignPickDialog";

vi.mock("../../api/queries", () => ({
  useAssignPick: () => ({ mutate: vi.fn(), reset: vi.fn(), isPending: false, error: null }),
  useClearReservedPick: () => ({ mutate: vi.fn(), isPending: false, error: null }),
}));

const player = (id: number, name: string, position: string): PlayerSummary => ({
  id,
  name,
  position,
  teamAbv: "BUF",
});
const pool = [
  player(1, "Josh Allen", "QB"),
  player(2, "Tyler Bass", "K"),
  player(3, "Bills D", "DEF"),
];
const draft = {
  seasonId: 5,
  picks: [],
  reservedPicks: [],
  currentPickOverall: 1,
} as unknown as DraftState;

const listed = () =>
  screen.queryAllByRole("button").filter((b) => /^(Josh|Tyler|Bills)/.test(b.textContent ?? ""));

describe("AssignPickDialog", () => {
  it("lists kickers and defenses stored as DEF under their position chips", () => {
    render(
      <AssignPickDialog
        draft={draft}
        pickNumber={1}
        teamName="Kings"
        pool={pool}
        onClose={vi.fn()}
      />,
    );
    expect(listed()).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: "K" }));
    expect(listed().map((b) => b.textContent)).toEqual(["Tyler BassK BUF"]);
    fireEvent.click(screen.getByRole("button", { name: "K" }));
    fireEvent.click(screen.getByRole("button", { name: "DST" }));
    expect(listed().map((b) => b.textContent)).toEqual(["Bills DDST BUF"]);
  });
});
