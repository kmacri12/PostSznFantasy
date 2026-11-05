import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Feed, FeedItem } from "../api/types";
import { SeasonContext } from "../contexts/SeasonContext";
import { testSeason } from "../test/season";
import FeedPage from "./FeedPage";

const useFeed = vi.fn();
const post = vi.fn();
const markViewed = vi.fn();
vi.mock("../api/queries", () => ({
  useFeed: (...args: unknown[]) => useFeed(...args),
  useMarkFeedViewed: () => ({ mutate: markViewed, isPending: false }),
  usePostMessage: () => ({ mutate: post, isPending: false, error: null }),
  useDeleteMessage: () => ({ mutate: vi.fn(), isPending: false, error: null }),
}));
vi.mock("../hooks/useFeedLive", () => ({ useFeedLive: () => ({ isConnected: true }) }));
vi.mock("../contexts/UserContext", () => ({ useUser: () => ({ userId: 3 }) }));

const message = (
  id: number,
  authorUserId: number,
  canDelete: boolean,
  isNew = false,
): FeedItem => ({
  type: "message",
  id,
  createdAt: "2030-01-11T19:00:00Z",
  authorUserId,
  authorName: authorUserId === 3 ? "Kyle" : "Dave",
  body: `message ${id}`,
  gifUrl: null,
  canDelete,
  isNew,
});

const feedOf = (items: FeedItem[], extra: Partial<Feed> = {}) => ({
  data: { pages: [{ items, nextBefore: null, hasNew: false, canPost: true, ...extra }] },
  isLoading: false,
  isError: false,
  hasNextPage: false,
  isFetchingNextPage: false,
  fetchNextPage: vi.fn(),
  refetch: vi.fn(),
});

const renderPage = () =>
  render(
    <SeasonContext.Provider value={testSeason({}, true)}>
      <FeedPage />
    </SeasonContext.Provider>,
  );

beforeEach(() => {
  window.scrollTo = vi.fn();
  useFeed.mockReset();
  post.mockReset();
  markViewed.mockReset();
});

describe("FeedPage", () => {
  it("shows own messages as You and delete buttons only where allowed", () => {
    useFeed.mockReturnValue(feedOf([message(2, 4, false), message(1, 3, true)]));
    renderPage();
    expect(screen.getByText("You")).toBeInTheDocument();
    expect(screen.getByText("Dave")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Delete message/ })).toHaveLength(1);
  });

  it("sends the typed message", () => {
    useFeed.mockReturnValue(feedOf([]));
    renderPage();
    fireEvent.change(screen.getByRole("textbox", { name: "Message the league" }), {
      target: { value: "  see you Saturday " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    expect(post).toHaveBeenCalledWith(
      { body: "see you Saturday", gifUrl: undefined },
      expect.anything(),
    );
  });

  it("replaces the message box with a read-only note in an archived season", () => {
    useFeed.mockReturnValue(feedOf([message(1, 4, false)], { canPost: false }));
    renderPage();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByText(/archived, so the Feed is read-only/)).toBeInTheDocument();
  });

  it("marks the feed viewed up to the newest item and draws a New divider", () => {
    useFeed.mockReturnValue(
      feedOf([message(5, 4, false, true), message(4, 4, false)], { hasNew: true }),
    );
    renderPage();
    expect(markViewed).toHaveBeenCalledWith({ upToEventId: undefined, upToMessageId: 5 });
    expect(screen.getByText("New")).toBeInTheDocument();
  });
});
