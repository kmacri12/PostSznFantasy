import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import LeaveLeagueDialog from "./LeaveLeagueDialog";

const mocks = vi.hoisted(() => ({ leave: vi.fn() }));

vi.mock("../../api/queries", () => ({
  useLeaveLeague: () => ({ mutate: mocks.leave, isPending: false, error: null }),
}));

const renderDialog = (onlyCommissioner: boolean, onOpenMembers = vi.fn()) =>
  render(
    <LeaveLeagueDialog
      leagueId={3}
      userId={1}
      leagueName="Pals"
      onlyCommissioner={onlyCommissioner}
      onOpenMembers={onOpenMembers}
      onClose={vi.fn()}
    />,
  );

describe("LeaveLeagueDialog", () => {
  it("explains what happens and leaves on confirm", () => {
    renderDialog(false);
    expect(screen.getByText(/freed with its roster/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Leave league" }));
    expect(mocks.leave).toHaveBeenCalled();
  });

  it("sends the only commissioner to the members list instead", () => {
    const openMembers = vi.fn();
    renderDialog(true, openMembers);
    expect(screen.queryByRole("button", { name: "Leave league" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Open members" }));
    expect(openMembers).toHaveBeenCalled();
  });
});
