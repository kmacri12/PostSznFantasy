import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MemberSummary } from "../../api/types";
import TeamOwnerSheet from "./TeamOwnerSheet";

const mocks = vi.hoisted(() => ({ mutate: vi.fn() }));

vi.mock("../../api/queries", () => ({
  useAssignTeamOwner: () => ({ mutate: mocks.mutate, isPending: false, error: null }),
}));

const member = (userId: number, username: string, teamId: number | null): MemberSummary => ({
  userId,
  username,
  role: "member",
  teamId,
  teamName: teamId === null ? null : `Team ${teamId}`,
});

beforeEach(() => mocks.mutate.mockClear());

describe("TeamOwnerSheet", () => {
  const renderSheet = () =>
    render(
      <TeamOwnerSheet
        seasonId={9}
        teamId={2}
        members={[member(1, "Kyle", 1), member(2, "Dave", 2), member(3, "Pat", null)]}
        onClose={vi.fn()}
      />,
    );

  it("lists members without a team first and assigns one", () => {
    renderSheet();
    const names = screen.getAllByRole("listitem").map((row) => row.textContent);
    expect(names[0]).toContain("Pat");
    fireEvent.click(screen.getByRole("button", { name: "Assign Pat" }));
    expect(mocks.mutate).toHaveBeenCalledWith({ teamId: 2, userId: 3 }, expect.anything());
  });

  it("marks the current owner and offers to move members off their own team", () => {
    renderSheet();
    expect(screen.getByText("Owner")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Assign Dave" })).toBeNull();
    expect(screen.getByRole("button", { name: "Move Kyle" })).toBeTruthy();
  });

  it("can remove the owner", () => {
    renderSheet();
    fireEvent.click(screen.getByRole("button", { name: "Remove the owner" }));
    expect(mocks.mutate).toHaveBeenCalledWith({ teamId: 2, userId: null }, expect.anything());
  });
});
