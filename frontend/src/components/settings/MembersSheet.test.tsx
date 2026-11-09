import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MemberSummary } from "../../api/types";
import MembersSheet from "./MembersSheet";

const mocks = vi.hoisted(() => ({ setRole: vi.fn(), remove: vi.fn(), regenerate: vi.fn() }));

vi.mock("../../api/queries", () => ({
  useSetMemberRole: () => ({ mutate: mocks.setRole, isPending: false, error: null }),
  useRegenerateInvite: () => ({ mutate: mocks.regenerate, isPending: false, error: null }),
  useRemoveMember: () => ({ mutate: mocks.remove, isPending: false, error: null }),
}));

const member = (userId: number, username: string, role: MemberSummary["role"]): MemberSummary => ({
  userId,
  username,
  role,
  teamId: userId,
  teamName: `${username}'s team`,
});

const renderSheet = (members: MemberSummary[]) =>
  render(<MembersSheet leagueId={3} members={members} currentUserId={1} onClose={vi.fn()} />);

beforeEach(() => {
  mocks.setRole.mockClear();
  mocks.remove.mockClear();
  mocks.regenerate.mockClear();
});

describe("MembersSheet", () => {
  it("locks the toggle of the only commissioner", () => {
    renderSheet([member(1, "Kyle", "commissioner"), member(2, "Dave", "member")]);
    expect(screen.getByRole("switch", { name: "Commissioner: Kyle" })).toBeDisabled();
    expect(screen.getByRole("switch", { name: "Commissioner: Dave" })).toBeEnabled();
  });

  it("unlocks both toggles when there are two commissioners", () => {
    renderSheet([member(1, "Kyle", "commissioner"), member(2, "Dave", "commissioner")]);
    expect(screen.getByRole("switch", { name: "Commissioner: Kyle" })).toBeEnabled();
  });

  it("promotes a member", () => {
    renderSheet([member(1, "Kyle", "commissioner"), member(2, "Dave", "member")]);
    fireEvent.click(screen.getByRole("switch", { name: "Commissioner: Dave" }));
    expect(mocks.setRole).toHaveBeenCalledWith({ userId: 2, role: "commissioner" });
  });

  it("offers no removal for yourself and asks before removing someone", () => {
    renderSheet([member(1, "Kyle", "commissioner"), member(2, "Dave", "member")]);
    expect(screen.getAllByRole("button", { name: "Remove from league" })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Remove from league" }));
    expect(mocks.remove).not.toHaveBeenCalled();
    fireEvent.click(
      within(screen.getByRole("dialog", { name: "Remove Dave?" })).getByRole("button", {
        name: "Remove from league",
      }),
    );
    expect(mocks.remove).toHaveBeenCalledWith(2, expect.anything());
  });

  it("says the invite link is retired after a removal and offers Regenerate", () => {
    mocks.remove.mockImplementation((_id, options) => {
      options.onSuccess();
      options.onSettled();
    });
    renderSheet([member(1, "Kyle", "commissioner"), member(2, "Dave", "member")]);
    fireEvent.click(screen.getByRole("button", { name: "Remove from league" }));
    fireEvent.click(
      within(screen.getByRole("dialog", { name: "Remove Dave?" })).getByRole("button", {
        name: "Remove from league",
      }),
    );
    expect(screen.getByText(/invite link was retired/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Regenerate" }));
    expect(mocks.regenerate).toHaveBeenCalled();
    mocks.remove.mockReset();
  });
});
