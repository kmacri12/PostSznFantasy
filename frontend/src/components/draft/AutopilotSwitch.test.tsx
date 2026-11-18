import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DraftState } from "../../api/types";
import AutopilotSwitch from "./AutopilotSwitch";

const mutate = vi.hoisted(() => vi.fn());
vi.mock("../../api/queries", () => ({
  useSetAutopilot: () => ({ mutate, isPending: false, isError: false, error: null }),
}));

const draft = (autopilotTeamIds: number[]) =>
  ({ seasonId: 5, status: "in_progress", autopilotTeamIds }) as unknown as DraftState;

describe("AutopilotSwitch", () => {
  it("switches my team's autopilot on and says what it does", () => {
    render(<AutopilotSwitch draft={draft([])} teamId={10} />);
    const toggle = screen.getByRole("switch", { name: "Autopilot" });
    expect(toggle).not.toBeChecked();
    expect(screen.getByText(/^Off\. Stepping away\?/)).toBeInTheDocument();
    fireEvent.click(toggle);
    expect(mutate).toHaveBeenCalledWith({ teamId: 10, enabled: true });
  });

  it("shows it on, with the way back", () => {
    render(<AutopilotSwitch draft={draft([10])} teamId={10} />);
    expect(screen.getByRole("switch", { name: "Autopilot" })).toBeChecked();
    expect(screen.getByText(/Picking yourself turns it off/)).toBeInTheDocument();
  });
});
