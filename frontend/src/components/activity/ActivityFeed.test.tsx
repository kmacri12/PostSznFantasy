import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActivityEvent } from "../../api/types";
import ActivityFeed from "./ActivityFeed";

const useActivityFeed = vi.fn();
const markViewed = vi.fn();
vi.mock("../../api/queries", () => ({
  useActivityFeed: (...args: unknown[]) => useActivityFeed(...args),
  useMarkActivityViewed: () => ({ mutate: markViewed }),
}));

const event = (id: number, isNew: boolean): ActivityEvent => ({
  id,
  kind: "lineup_move",
  createdAt: "2030-01-11T19:00:00Z",
  teamId: 4,
  teamName: "Alpha",
  actorUserId: 2,
  actorName: "ann",
  isNew,
  payload: {
    round: 1,
    playerId: id,
    playerName: `Player ${id}`,
    fromSlot: null,
    toSlot: "QB",
    displaced: null,
    changedSlots: [0],
    byCommissioner: false,
  },
});

const feedOf = (events: ActivityEvent[], hasNew: boolean) => ({
  data: { pages: [{ events, nextBefore: null, hasNew }] },
  isLoading: false,
  hasNextPage: false,
  isFetchingNextPage: false,
  fetchNextPage: vi.fn(),
});

beforeEach(() => {
  markViewed.mockReset();
  useActivityFeed.mockReset();
});

describe("ActivityFeed", () => {
  it("is collapsed by default, with a dot and the word New when there is new activity", () => {
    useActivityFeed.mockReturnValue(feedOf([event(2, true), event(1, false)], true));
    render(<ActivityFeed scope="leagues" id={7} title="League activity" />);
    const toggle = screen.getByRole("button", { name: /League activity/ });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByRole("img", { name: "New activity" })).toBeTruthy();
    expect(screen.queryByText(/Player 2/)).toBeNull();
  });

  it("shows no dot when nothing is new", () => {
    useActivityFeed.mockReturnValue(feedOf([event(1, false)], false));
    render(<ActivityFeed scope="teams" id={4} title="Team activity" />);
    expect(screen.queryByRole("img", { name: "New activity" })).toBeNull();
    expect(markViewed).not.toHaveBeenCalled();
  });

  it("marks the newest event as seen on expand, clearing the dot, and tags the new rows", () => {
    useActivityFeed.mockReturnValue(feedOf([event(2, true), event(1, false)], true));
    render(<ActivityFeed scope="leagues" id={7} title="League activity" />);
    fireEvent.click(screen.getByRole("button", { name: /League activity/ }));
    expect(markViewed).toHaveBeenCalledWith(2);
    expect(screen.queryByRole("img", { name: "New activity" })).toBeNull();
    expect(screen.getByText(/Player 2/)).toBeTruthy();
    expect(screen.getAllByText("New")).toHaveLength(1);
  });

  it("does not ask the server again on collapse", () => {
    useActivityFeed.mockReturnValue(feedOf([event(1, true)], true));
    render(<ActivityFeed scope="leagues" id={7} title="League activity" />);
    const toggle = screen.getByRole("button", { name: /League activity/ });
    fireEvent.click(toggle);
    fireEvent.click(toggle);
    expect(markViewed).toHaveBeenCalledTimes(1);
  });

  it("also marks events that arrive while the feed is open, so they are not new once it closes", () => {
    useActivityFeed.mockReturnValue(feedOf([event(1, true)], true));
    const { rerender } = render(<ActivityFeed scope="leagues" id={7} title="League activity" />);
    fireEvent.click(screen.getByRole("button", { name: /League activity/ }));
    expect(markViewed).toHaveBeenLastCalledWith(1);
    useActivityFeed.mockReturnValue(feedOf([event(3, true), event(1, false)], true));
    rerender(<ActivityFeed scope="leagues" id={7} title="League activity" />);
    expect(markViewed).toHaveBeenLastCalledWith(3);
    expect(screen.getAllByText("New")).toHaveLength(2);
  });

  it("does not tag already-seen rows as new when reopened", () => {
    useActivityFeed.mockReturnValue(feedOf([event(1, true)], true));
    render(<ActivityFeed scope="leagues" id={7} title="League activity" />);
    const toggle = screen.getByRole("button", { name: /League activity/ });
    fireEvent.click(toggle);
    expect(screen.getAllByText("New")).toHaveLength(1);
    useActivityFeed.mockReturnValue(feedOf([event(1, false)], false));
    fireEvent.click(toggle);
    fireEvent.click(toggle);
    expect(screen.queryByText("New")).toBeNull();
  });
});
