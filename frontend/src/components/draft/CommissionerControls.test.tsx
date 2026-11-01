import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DraftState } from "../../api/types";
import CommissionerControls from "./CommissionerControls";

const mutate = vi.fn();
vi.mock("../../api/queries", () => ({
  useDraftControl: () => ({ mutate, error: null }),
}));

const draft = (status: DraftState["status"]) => ({ seasonId: 1, status }) as DraftState;

const open = (status: DraftState["status"]) => {
  render(<CommissionerControls draft={draft(status)} />);
  fireEvent.click(screen.getByRole("button", { name: "Draft controls" }));
};

describe("CommissionerControls", () => {
  it("keeps the actions hidden until the one button is pressed", () => {
    render(<CommissionerControls draft={draft("in_progress")} />);
    expect(screen.queryByRole("button", { name: "Pause" })).toBeNull();
  });

  it("offers pause, auto-pick and undo while the draft runs", () => {
    open("in_progress");
    for (const name of ["Pause", "Auto-pick now", "Undo last pick"]) {
      expect(screen.getByRole("button", { name })).toBeTruthy();
    }
    expect(screen.queryByRole("button", { name: "Resume" })).toBeNull();
  });

  it("offers resume when paused", () => {
    open("paused");
    fireEvent.click(screen.getByRole("button", { name: "Resume" }));
    expect(mutate).toHaveBeenCalledWith("resume", expect.anything());
  });
});
