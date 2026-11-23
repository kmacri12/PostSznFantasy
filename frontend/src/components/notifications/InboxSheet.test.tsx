import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Inbox } from "../../api/types";
import InboxSheet from "./InboxSheet";

const mocks = vi.hoisted(() => ({ markRead: vi.fn(), clear: vi.fn() }));

vi.mock("../../api/queries", () => ({
  useMarkInboxRead: () => ({ mutate: mocks.markRead }),
  useClearInbox: () => ({ mutate: mocks.clear, isPending: false }),
}));

const inbox = (count: number): Inbox => ({
  unreadCount: 0,
  items: Array.from({ length: count }, (_, id) => ({
    id: id + 1,
    kind: "draft_lobby",
    leagueId: 3,
    leagueName: "Family League",
    payload: { seasonId: 9 },
    createdAt: "2027-01-09T12:00:00Z",
    read: true,
  })),
});

const show = (data: Inbox) =>
  render(
    <MemoryRouter>
      <InboxSheet inbox={data} onClose={vi.fn()} />
    </MemoryRouter>,
  );

beforeEach(() => vi.clearAllMocks());

describe("the notifications sheet", () => {
  it("clears everything with one tap on Clear all", () => {
    show(inbox(2));
    fireEvent.click(screen.getByRole("button", { name: "Clear all" }));
    expect(mocks.clear).toHaveBeenCalledOnce();
  });

  it("has nothing to clear when the inbox is empty", () => {
    show(inbox(0));
    expect(screen.queryByRole("button", { name: "Clear all" })).toBeNull();
    expect(screen.getByText(/Nothing in the last 30 days/)).toBeInTheDocument();
  });
});
